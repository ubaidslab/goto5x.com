import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGatewayProvider } from "@prisma/client";
import { round2 } from "../orders/money.util";
import { OrdersService } from "../orders/orders.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SettingsService } from "../settings-registry/settings.service";
import { BankTransferGatewayAdapter } from "./adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "./adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "./adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "./adapters/raast-gateway.adapter";
import { decryptGatewayCredential, encryptGatewayCredential } from "./payment-gateway-credential-crypto.util";
import { GatewayVerifyResult, SellerPaymentGatewayAdapter } from "./seller-payment-gateway-adapter.interface";
import { GatewayHealthService } from "./gateway-health.service";

/**
 * FR-6.36 - Raast is offered first (lowest priorityOrder), Easypaisa/
 * JazzCash/bank follow as equally-supported options; derived automatically
 * from the provider at connect time, never a seller-facing reorder control
 * (not part of FR-6.39's scope).
 */
const PROVIDER_PRIORITY: Record<PaymentGatewayProvider, number> = {
  raast: 0,
  easypaisa: 1,
  jazzcash: 2,
  bank: 3,
};

/**
 * Never returns `apiKeyEncrypted`/`apiSecretEncrypted` - same explicit
 * SAFE_SELECT-allowlist discipline as SellerVerificationEmailsService,
 * rather than a decorator a future field addition could silently bypass.
 */
const SAFE_SELECT = {
  id: true,
  storeId: true,
  provider: true,
  merchantId: true,
  isActive: true,
  priorityOrder: true,
  connectedAt: true,
  updatedAt: true,
} as const;

/**
 * SRS §5.6h/FR-6.36-6.39 - the orchestrating service, mirroring
 * OrderVerificationService's exact shape: a `Map<provider, adapter>` the
 * service never branches on beyond a lookup, seller-facing CRUD through
 * TenantPrismaService (this table is store-scoped, RLS-protected), and a
 * buyer-facing verify path through PrismaAdminService (no seller session
 * exists at that point, same reasoning as StorefrontService/
 * OrderVerificationService's own buyer-facing methods).
 */
@Injectable()
export class PaymentGatewayService {
  private readonly encryptionKey: Buffer;
  private readonly adapters: Map<PaymentGatewayProvider, SellerPaymentGatewayAdapter>;

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
    private readonly gatewayHealth: GatewayHealthService,
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

  /** FR-6.39 - seller-facing list, ordered the same way the checkout provider list will be (Raast first). */
  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.storePaymentGatewayConnection.findMany({
        where: { storeId },
        select: SAFE_SELECT,
        orderBy: { priorityOrder: "asc" },
      });
    });
  }

  /** FR-6.36/6.39 - one connection per provider; reconnecting the same provider updates it (fresh credentials, same priority). */
  async connect(
    sellerId: string,
    storeId: string,
    dto: { provider: PaymentGatewayProvider; merchantId?: string; apiKey: string; apiSecret?: string },
  ) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const apiKeyEncrypted = encryptGatewayCredential(dto.apiKey, this.encryptionKey);
      const apiSecretEncrypted = dto.apiSecret ? encryptGatewayCredential(dto.apiSecret, this.encryptionKey) : null;

      return tx.storePaymentGatewayConnection.upsert({
        where: { uniq_store_gateway_provider: { storeId, provider: dto.provider } },
        create: {
          storeId,
          provider: dto.provider,
          merchantId: dto.merchantId ?? null,
          apiKeyEncrypted,
          apiSecretEncrypted,
          priorityOrder: PROVIDER_PRIORITY[dto.provider],
        },
        update: {
          merchantId: dto.merchantId ?? null,
          apiKeyEncrypted,
          apiSecretEncrypted,
          isActive: true,
        },
        select: SAFE_SELECT,
      });
    });
  }

  async setActive(sellerId: string, storeId: string, provider: PaymentGatewayProvider, isActive: boolean) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.storePaymentGatewayConnection.findUnique({
        where: { uniq_store_gateway_provider: { storeId, provider } },
      });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Connection not found.");
      return tx.storePaymentGatewayConnection.update({
        where: { uniq_store_gateway_provider: { storeId, provider } },
        data: { isActive },
        select: SAFE_SELECT,
      });
    });
  }

  async remove(sellerId: string, storeId: string, provider: PaymentGatewayProvider) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const existing = await tx.storePaymentGatewayConnection.findUnique({
        where: { uniq_store_gateway_provider: { storeId, provider } },
      });
      if (!existing || existing.storeId !== storeId) throw new NotFoundException("Connection not found.");
      await tx.storePaymentGatewayConnection.delete({ where: { id: existing.id } });
      return { deleted: true };
    });
  }

  /** FR-6.39 - a lightweight auth-only call via the adapter's testMode, never touching a real order. */
  async testConnection(sellerId: string, storeId: string, provider: PaymentGatewayProvider) {
    const connection = await this.tenantPrisma.run(sellerId, async (tx) => {
      const found = await tx.storePaymentGatewayConnection.findUnique({
        where: { uniq_store_gateway_provider: { storeId, provider } },
      });
      if (!found || found.storeId !== storeId) throw new NotFoundException("Connection not found.");
      return found;
    });
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new BadRequestException("This provider is not supported.");
    if (!connection.apiKeyEncrypted) {
      throw new BadRequestException("This connection has no credentials saved yet.");
    }

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
   * Buyer-facing - the same unguessable statusLookupToken every other
   * buyer-facing order action resolves first (OrderVerificationService's
   * own precedent), rather than a raw orderId a buyer's browser would
   * otherwise need to know and which would grant no real access control.
   */
  private async resolveOrderByToken(token: string) {
    const order = await this.prismaAdmin.order.findUnique({
      where: { statusLookupToken: token },
      select: { id: true, storeId: true },
    });
    if (!order) throw new NotFoundException("Order not found.");
    return order;
  }

  async getCheckoutOptionsByToken(token: string) {
    const order = await this.resolveOrderByToken(token);
    return this.listActiveForCheckout(order.storeId);
  }

  async verifyByToken(token: string, provider: PaymentGatewayProvider, reference?: string) {
    const order = await this.resolveOrderByToken(token);
    return this.verifyAndConfirm(order.storeId, order.id, provider, reference);
  }

  /** Buyer-facing - the checkout provider list for a store, active connections only, Raast first. No credentials, no seller session. */
  async listActiveForCheckout(storeId: string) {
    const connections = await this.prismaAdmin.storePaymentGatewayConnection.findMany({
      where: { storeId, isActive: true },
      select: { provider: true, priorityOrder: true },
      orderBy: { priorityOrder: "asc" },
    });
    return connections.map((c) => c.provider);
  }

  /**
   * FR-6.38 - the buyer-facing entry point. On a verified match, confirms
   * the order through the exact same OrdersService.markAsPaid() core
   * Modules 52/53's manual/OTP paths already use - never a second
   * confirmation path. The Financial Truth Invariant is unchanged:
   * markAsPaid() still runs its own "not pending"/verification-cleared
   * checks regardless of how it was reached.
   */
  async verifyAndConfirm(storeId: string, orderId: string, provider: PaymentGatewayProvider, reference?: string) {
    const [order, store] = await Promise.all([
      this.prismaAdmin.order.findUnique({ where: { id: orderId } }),
      this.prismaAdmin.store.findUnique({ where: { id: storeId } }),
    ]);
    if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
    if (!store) throw new NotFoundException("Store not found.");

    const result = await this.chargeViaGateway(storeId, provider, orderId, Number(order.totalAmount), order.currency, reference);
    if (!result.verified) {
      throw new BadRequestException("Payment could not be verified with this provider yet.");
    }

    return this.orders.markAsPaid(store.sellerId, storeId, orderId);
  }

  /**
   * FR-6.52 (Module 76) - the partial-advance amount (a plan-gated
   * store-level percentage of the order total) + this store's active
   * gateway options, buyer-facing. `orderId`'s own OrderVerification row
   * carries the channel snapshot (never re-resolved from the store's
   * CURRENT setting) - same reasoning as regenerateAndSend()'s comment.
   */
  async getPartialAdvanceOptionsByToken(token: string) {
    const { order } = await this.resolvePendingPartialAdvanceOrder(token);
    const percent = await this.settings.resolve<number>("orders.prepaid_partial_advance_percent", { storeId: order.storeId });
    return {
      amount: round2(Number(order.totalAmount) * (percent / 100)),
      currency: order.currency,
      providers: await this.listActiveForCheckout(order.storeId),
    };
  }

  /**
   * FR-6.52 - the buyer-facing verify entry point. On a verified partial
   * payment, the order auto-confirms: this channel's OrderVerification row
   * moves straight to "verified" (a direct Prisma write mirroring
   * OrderVerificationService.verifyOtp()'s own update + timeline write,
   * rather than a new PaymentGatewayModule -> OrderVerificationModule edge
   * for a few lines - every OrderVerification status transition in this
   * codebase is already written at its own call site, never through a
   * shared helper) and markAsPaid() runs immediately after, same as a
   * full-amount gateway payment already does.
   */
  async verifyPartialAdvanceByToken(token: string, provider: PaymentGatewayProvider, reference?: string) {
    const { order, verification, store } = await this.resolvePendingPartialAdvanceOrder(token);
    const percent = await this.settings.resolve<number>("orders.prepaid_partial_advance_percent", { storeId: order.storeId });
    const amount = round2(Number(order.totalAmount) * (percent / 100));

    const result = await this.chargeViaGateway(order.storeId, provider, order.id, amount, order.currency, reference);
    if (!result.verified) {
      throw new BadRequestException("Payment could not be verified with this provider yet.");
    }

    await this.prismaAdmin.orderVerification.update({
      where: { orderId: order.id },
      data: { status: "verified", verifiedAt: new Date() },
    });
    await this.prismaAdmin.orderTimelineEvent.create({
      data: { storeId: order.storeId, orderId: order.id, eventType: "verification_confirmed", afterValue: { channel: verification.channel } },
    });

    return this.orders.markAsPaid(store.sellerId, order.storeId, order.id);
  }

  private async resolvePendingPartialAdvanceOrder(token: string) {
    const order = await this.prismaAdmin.order.findUnique({
      where: { statusLookupToken: token },
      select: { id: true, storeId: true, totalAmount: true, currency: true },
    });
    if (!order) throw new NotFoundException("Order not found.");

    const [verification, store] = await Promise.all([
      this.prismaAdmin.orderVerification.findUnique({ where: { orderId: order.id } }),
      this.prismaAdmin.store.findUnique({ where: { id: order.storeId } }),
    ]);
    if (!store) throw new NotFoundException("Store not found.");
    if (!verification || verification.channel !== "prepaid_partial_advance") {
      throw new BadRequestException("This order isn't using the prepaid partial-advance verification channel.");
    }
    if (verification.status !== "pending") {
      throw new BadRequestException(`This order's verification is already "${verification.status}".`);
    }

    return { order, verification, store };
  }

  /** Shared connection/adapter/decrypt/verify core - the only difference between a full-amount and a partial-advance gateway charge is the `amount` passed in. */
  private async chargeViaGateway(
    storeId: string,
    provider: PaymentGatewayProvider,
    orderId: string,
    amount: number,
    currency: string,
    reference: string | undefined,
  ): Promise<GatewayVerifyResult> {
    const connection = await this.prismaAdmin.storePaymentGatewayConnection.findUnique({
      where: { uniq_store_gateway_provider: { storeId, provider } },
    });
    if (!connection || !connection.isActive || connection.storeId !== storeId) {
      throw new NotFoundException("No active connection for this provider.");
    }
    if (!connection.apiKeyEncrypted) {
      throw new BadRequestException("This connection has no credentials saved yet.");
    }

    const adapter = this.adapters.get(provider);
    if (!adapter) throw new BadRequestException("This provider is not supported.");

    const result = await adapter.verifyPayment({
      connection: {
        merchantId: connection.merchantId,
        apiKey: decryptGatewayCredential(connection.apiKeyEncrypted, this.encryptionKey),
        apiSecret: connection.apiSecretEncrypted ? decryptGatewayCredential(connection.apiSecretEncrypted, this.encryptionKey) : null,
      },
      orderId,
      amount,
      currency,
      reference,
    });
    // Module 67 (FR-6.44) - "the instant it happens," not just the 6-hourly
    // sweep: every real checkout verification updates this connection's
    // rolling health stats immediately.
    await this.gatewayHealth.recordResult(connection.id, result.verified);
    return result;
  }
}
