import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, PaymentGatewayProvider } from "@prisma/client";
import { BankTransferGatewayAdapter } from "../payment-gateway/adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "../payment-gateway/adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "../payment-gateway/adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "../payment-gateway/adapters/raast-gateway.adapter";
import { decryptGatewayCredential, encryptGatewayCredential } from "../payment-gateway/payment-gateway-credential-crypto.util";
import { GatewayVerifyContext, GatewayVerifyResult, SellerPaymentGatewayAdapter } from "../payment-gateway/seller-payment-gateway-adapter.interface";
import { round2 } from "../orders/money.util";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { RedisService } from "../common/redis/redis.service";
import { SettingsService } from "../settings-registry/settings.service";

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const PROVIDER_PRIORITY: Record<PaymentGatewayProvider, number> = {
  raast: 0,
  easypaisa: 1,
  jazzcash: 2,
  bank: 3,
};

/** Never returns credential ciphertext - same allowlist discipline as PaymentGatewayService's SAFE_SELECT. */
const SAFE_SELECT = {
  id: true,
  provider: true,
  merchantId: true,
  isActive: true,
  verifiedCount: true,
  failedCount: true,
  lastVerifiedAt: true,
  lastFailedAt: true,
  connectedAt: true,
  updatedAt: true,
} as const;

/**
 * Founder-directed scope addition - "Platform Merchant Connection." Reuses
 * Module 62's exact adapter architecture (SellerPaymentGatewayAdapter,
 * AES-256-GCM credential encryption) - UZEYN is the connected merchant
 * here, not a seller, so this is deliberately its own small module rather
 * than folded into PaymentGatewayModule: that module imports OrdersModule,
 * which imports BillingModule, which needs to inject this service to
 * attempt auto-verification on a plan-fee payment - importing
 * PaymentGatewayModule into BillingModule would create a cycle.
 *
 * Dormant-by-default (schema's own `isActive @default(false)` doc comment):
 * `tryAutoVerify()` returns null whenever no active connection exists for
 * the given provider, which every caller treats identically to "the
 * platform gateway isn't live yet" - falling back to the existing manual
 * bank-instructions + admin-confirm flow. Nothing here assumes real
 * credentials exist; an admin must both connect AND explicitly activate.
 *
 * Financial-safety hardening (founder-directed, post-build audit -
 * "money-adjacent territory, precision matters more than speed").
 * `verifyPayment()` is a synchronous poll/inquire call this service makes
 * OUT to the gateway's own transaction-status API - there is no inbound
 * webhook receiver anywhere in this design (confirmed: none of the 4
 * adapters expose one, and neither does Module 62's seller-side
 * equivalent), so "webhook signature verification" doesn't apply; the
 * founder's confirmed replacement requirements for a poll-based design are
 * all enforced in `tryAutoVerify()` below:
 *  - Outbound auth integrity: every adapter's `verifyPayment()` now throws
 *    if its configured API base isn't `https://`, and the real decrypted
 *    API key is always sent as the `Authorization: Bearer` credential -
 *    Node's `fetch()` performs standard TLS certificate validation with no
 *    override anywhere in this codebase.
 *  - Polling idempotency: `PlatformGatewayConsumedReference` is a unique
 *    (provider, reference) ledger - a given real-world transaction
 *    reference can be consumed (credited) exactly once, ever, enforced as
 *    a DB unique-constraint race-guard, not just an application check.
 *  - Poll rate/backoff: no automatic retry loop exists here at all - a
 *    failed/timed-out attempt returns null once and falls back to manual.
 *    Resubmission is guarded two ways at the caller (WalletService.
 *    requestPlanFeePayment / TemplatePurchaseService.requestPurchase): the
 *    "already have a pending request" check stops a *sequential* resubmit,
 *    and `claimSubmissionCooldown()` below closes the concurrent-request
 *    race that check-then-create alone can't (an atomic Redis `SET NX EX`,
 *    Settings-Registry-configured, per (seller, scope)) - added post-launch
 *    after the founder specifically asked whether a retry-storm of rapid
 *    resubmissions was covered. The weekly reconciliation sweep only
 *    re-polls each already-consumed reference once per run.
 *  - Amount-mismatch handling: the gateway's own reported amount (when the
 *    response includes one) is compared against the requested amount
 *    before trusting `verified` - a mismatch is flagged
 *    (`PlatformGatewayFlaggedVerification`, reason "amount_mismatch") and
 *    never auto-activates.
 *  - Timeout/failure-safe fallback: `adapter.verifyPayment()` is wrapped in
 *    try/catch - any thrown error (the adapter's own 10s
 *    `AbortSignal.timeout`, a network failure, a non-JSON response) is
 *    logged and treated identically to "no active connection," falling
 *    back to the manual admin-confirm flow rather than surfacing a 500 to
 *    the submitting seller.
 *  - Weekly reconciliation: see PlatformGatewayReconciliationService.
 */
@Injectable()
export class PlatformGatewayService {
  private readonly logger = new Logger(PlatformGatewayService.name);
  private readonly encryptionKey: Buffer;
  private readonly adapters: Map<PaymentGatewayProvider, SellerPaymentGatewayAdapter>;

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    config: ConfigService,
    raastAdapter: RaastGatewayAdapter,
    easypaisaAdapter: EasypaisaGatewayAdapter,
    jazzcashAdapter: JazzCashGatewayAdapter,
    bankAdapter: BankTransferGatewayAdapter,
  ) {
    this.encryptionKey = Buffer.from(config.getOrThrow<string>("PAYMENT_GATEWAY_CREDENTIAL_ENCRYPTION_KEY"), "base64");
    this.adapters = new Map([
      [raastAdapter.provider, raastAdapter as SellerPaymentGatewayAdapter],
      [easypaisaAdapter.provider, easypaisaAdapter as SellerPaymentGatewayAdapter],
      [jazzcashAdapter.provider, jazzcashAdapter as SellerPaymentGatewayAdapter],
      [bankAdapter.provider, bankAdapter as SellerPaymentGatewayAdapter],
    ]);
  }

  /** Admin-only. */
  list() {
    return this.prismaAdmin.platformGatewayConnection.findMany({ select: SAFE_SELECT, orderBy: { provider: "asc" } });
  }

  /** Admin-only - connecting (or reconnecting with fresh credentials) never auto-activates; a separate explicit setActive() call is always required. */
  async connect(dto: { provider: PaymentGatewayProvider; merchantId?: string; apiKey: string; apiSecret?: string }) {
    const apiKeyEncrypted = encryptGatewayCredential(dto.apiKey, this.encryptionKey);
    const apiSecretEncrypted = dto.apiSecret ? encryptGatewayCredential(dto.apiSecret, this.encryptionKey) : null;

    return this.prismaAdmin.platformGatewayConnection.upsert({
      where: { provider: dto.provider },
      create: {
        provider: dto.provider,
        merchantId: dto.merchantId ?? null,
        apiKeyEncrypted,
        apiSecretEncrypted,
      },
      update: {
        merchantId: dto.merchantId ?? null,
        apiKeyEncrypted,
        apiSecretEncrypted,
      },
      select: SAFE_SELECT,
    });
  }

  async setActive(provider: PaymentGatewayProvider, isActive: boolean) {
    const existing = await this.prismaAdmin.platformGatewayConnection.findUnique({ where: { provider } });
    if (!existing) throw new NotFoundException("This provider hasn't been connected yet.");
    if (isActive && !existing.apiKeyEncrypted) {
      throw new BadRequestException("Add real credentials before activating this connection.");
    }
    return this.prismaAdmin.platformGatewayConnection.update({ where: { provider }, data: { isActive }, select: SAFE_SELECT });
  }

  async remove(provider: PaymentGatewayProvider) {
    const existing = await this.prismaAdmin.platformGatewayConnection.findUnique({ where: { provider } });
    if (!existing) throw new NotFoundException("Connection not found.");
    await this.prismaAdmin.platformGatewayConnection.delete({ where: { provider } });
    return { deleted: true };
  }

  /** Admin-only - same lightweight auth-only testMode call as the seller-side equivalent. */
  async testConnection(provider: PaymentGatewayProvider) {
    const connection = await this.prismaAdmin.platformGatewayConnection.findUnique({ where: { provider } });
    if (!connection) throw new NotFoundException("Connection not found.");
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new BadRequestException("This provider is not supported.");
    if (!connection.apiKeyEncrypted) throw new BadRequestException("This connection has no credentials saved yet.");

    const result = await adapter.verifyPayment({
      connection: {
        merchantId: connection.merchantId,
        apiKey: decryptGatewayCredential(connection.apiKeyEncrypted, this.encryptionKey),
        apiSecret: connection.apiSecretEncrypted ? decryptGatewayCredential(connection.apiSecretEncrypted, this.encryptionKey) : null,
      },
      orderId: "",
      amount: 0,
      currency: "",
      testMode: true,
    });
    return { success: result.verified };
  }

  /**
   * Called by WalletService.requestPlanFeePayment() and
   * TemplatePurchaseService.requestPurchase() - `null` means "dormant,
   * fall back to the manual flow" (no active connection for ANY provider,
   * a timed-out/failed poll, an amount mismatch, or an already-consumed
   * reference), never thrown as an error. When multiple providers are
   * active simultaneously (unusual but not prevented), the same
   * Raast-first priority order the seller-side checkout list uses picks
   * which one attempts the charge.
   */
  async tryAutoVerify(orderRef: string, amount: number, currency: string, reference?: string): Promise<GatewayVerifyResult | null> {
    const active = await this.prismaAdmin.platformGatewayConnection.findMany({ where: { isActive: true } });
    if (active.length === 0) return null;

    const connection = [...active].sort((a, b) => PROVIDER_PRIORITY[a.provider] - PROVIDER_PRIORITY[b.provider])[0];
    if (!connection.apiKeyEncrypted) return null;

    const adapter = this.adapters.get(connection.provider);
    if (!adapter) return null;

    // Idempotency: a real-world payment reference can be consumed (drive an
    // auto-grant) exactly once, ever - a resubmission of the same reference
    // against a different request must never double-credit.
    if (reference) {
      const alreadyConsumed = await this.prismaAdmin.platformGatewayConsumedReference.findUnique({
        where: { provider_reference: { provider: connection.provider, reference } },
      });
      if (alreadyConsumed) {
        this.logger.warn(`Platform gateway reference reuse blocked: ${connection.provider} reference already consumed by order ${alreadyConsumed.orderRef}, refusing to also grant order ${orderRef}.`);
        return null;
      }
    }

    let result: GatewayVerifyResult;
    try {
      result = await adapter.verifyPayment(
        this.buildVerifyContext(connection.provider, connection.merchantId, connection.apiKeyEncrypted, connection.apiSecretEncrypted, orderRef, amount, currency, reference),
      );
    } catch (err) {
      // Timeout/failure-safe fallback: never let a gateway outage or
      // network failure surface as an error to the submitting seller -
      // fall back to the manual bank-instructions + admin-confirm flow,
      // identically to "no active connection."
      this.logger.warn(`Platform gateway auto-verify failed for ${connection.provider} order ${orderRef}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }

    if (result.verified && result.amount !== undefined && round2(result.amount) !== round2(amount)) {
      await this.flagVerification(connection.provider, orderRef, reference, amount, result.amount, currency, "amount_mismatch");
      await this.prismaAdmin.platformGatewayConnection.update({
        where: { id: connection.id },
        data: { failedCount: { increment: 1 }, lastFailedAt: new Date() },
      });
      return null; // never auto-activate on a mismatch, no matter what the gateway's responseCode claimed
    }

    if (result.verified && reference) {
      try {
        await this.prismaAdmin.platformGatewayConsumedReference.create({
          data: { provider: connection.provider, reference, orderRef, amount, currency },
        });
      } catch (err) {
        if (isUniqueConstraintViolation(err)) {
          // Raced with a concurrent request claiming the same reference first.
          this.logger.warn(`Platform gateway reference reuse race lost: ${connection.provider} reference claimed concurrently, refusing order ${orderRef}.`);
          return null;
        }
        throw err;
      }
    }

    await this.prismaAdmin.platformGatewayConnection.update({
      where: { id: connection.id },
      data: result.verified
        ? { verifiedCount: { increment: 1 }, lastVerifiedAt: new Date() }
        : { failedCount: { increment: 1 }, lastFailedAt: new Date() },
    });

    return result;
  }

  /**
   * Retry-storm guard (founder-directed, post-hardening follow-up). The
   * "already have a pending request" checks in WalletService.
   * requestPlanFeePayment() / TemplatePurchaseService.requestPurchase() stop
   * a *sequential* resubmission - once a request exists, every later attempt
   * is rejected before it ever reaches here - but that check-then-create is
   * not atomic, so two truly concurrent submissions from the same seller
   * could both pass it before either commits, each independently attempting
   * a real outbound gateway call. This closes that race with an atomic
   * Redis claim (`SET NX EX`): only the first of any concurrent burst for a
   * given (seller, scope) wins the slot; the rest must wait out the
   * Settings-Registry-configured cooldown. The caller passes a `scope` key
   * granular enough that two legitimately-independent submissions (a
   * plan-fee payment and a template purchase moments apart, as the
   * idempotency test does; or two different templates) don't collide.
   */
  async claimSubmissionCooldown(sellerId: string, scope: string): Promise<boolean> {
    const cooldownSeconds = await this.settings.resolve<number>("billing.platform_gateway_submission_cooldown_seconds");
    const key = `platform-gateway:submission-cooldown:${scope}:${sellerId}`;
    const claimed = await this.redis.set(key, "1", "EX", cooldownSeconds, "NX");
    return claimed === "OK";
  }

  private buildVerifyContext(
    provider: PaymentGatewayProvider,
    merchantId: string | null,
    apiKeyEncrypted: string,
    apiSecretEncrypted: string | null,
    orderId: string,
    amount: number,
    currency: string,
    reference?: string,
  ): GatewayVerifyContext {
    return {
      connection: {
        merchantId,
        apiKey: decryptGatewayCredential(apiKeyEncrypted, this.encryptionKey),
        apiSecret: apiSecretEncrypted ? decryptGatewayCredential(apiSecretEncrypted, this.encryptionKey) : null,
      },
      orderId,
      amount,
      currency,
      reference,
    };
  }

  private async flagVerification(
    provider: PaymentGatewayProvider,
    orderRef: string,
    reference: string | undefined,
    requestedAmount: number,
    gatewayAmount: number | undefined,
    currency: string,
    reason: "amount_mismatch" | "reconciliation_mismatch",
  ) {
    this.logger.error(`Platform gateway ${reason} for ${provider} order ${orderRef}: requested ${requestedAmount} ${currency}, gateway reported ${gatewayAmount ?? "n/a"}.`);
    await this.prismaAdmin.platformGatewayFlaggedVerification.create({
      data: { provider, orderRef, reference: reference ?? null, requestedAmount, gatewayAmount: gatewayAmount ?? null, currency, reason },
    });
  }

  /** Admin-only - the "flags for review" surface; never auto-resolved. */
  listFlagged(includeResolved = false) {
    return this.prismaAdmin.platformGatewayFlaggedVerification.findMany({
      where: includeResolved ? {} : { resolved: false },
      orderBy: { flaggedAt: "desc" },
    });
  }

  /** Admin-only - explicit human acknowledgement, never automatic. */
  async resolveFlagged(id: string, adminUserId: string) {
    const existing = await this.prismaAdmin.platformGatewayFlaggedVerification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Flagged verification not found.");
    return this.prismaAdmin.platformGatewayFlaggedVerification.update({
      where: { id },
      data: { resolved: true, resolvedAt: new Date(), resolvedByAdminId: adminUserId },
    });
  }

  /**
   * Called only by PlatformGatewayReconciliationService's weekly sweep -
   * re-polls the gateway for an already-consumed reference to confirm it
   * is STILL verified (catches a later reversal/chargeback the original
   * poll couldn't have known about). Never re-consumes or re-grants
   * anything itself - a mismatch here only flags for admin review.
   */
  async reconciliationRecheck(consumed: { provider: PaymentGatewayProvider; reference: string; orderRef: string; amount: Prisma.Decimal; currency: string }): Promise<void> {
    const connection = await this.prismaAdmin.platformGatewayConnection.findUnique({ where: { provider: consumed.provider } });
    if (!connection?.apiKeyEncrypted) return; // connection removed/deactivated since - nothing to reconcile against

    const adapter = this.adapters.get(consumed.provider);
    if (!adapter) return;

    const amount = Number(consumed.amount);
    let result: GatewayVerifyResult;
    try {
      result = await adapter.verifyPayment(
        this.buildVerifyContext(connection.provider, connection.merchantId, connection.apiKeyEncrypted, connection.apiSecretEncrypted, consumed.orderRef, amount, consumed.currency, consumed.reference),
      );
    } catch (err) {
      this.logger.warn(`Reconciliation re-poll failed for ${consumed.provider} order ${consumed.orderRef}: ${err instanceof Error ? err.message : String(err)} - skipping this cycle, not flagging on a transient failure.`);
      return;
    }

    if (!result.verified) {
      await this.flagVerification(consumed.provider, consumed.orderRef, consumed.reference, amount, result.amount, consumed.currency, "reconciliation_mismatch");
      return;
    }

    if (result.amount !== undefined && round2(result.amount) !== round2(amount)) {
      await this.flagVerification(consumed.provider, consumed.orderRef, consumed.reference, amount, result.amount, consumed.currency, "reconciliation_mismatch");
    }
  }
}
