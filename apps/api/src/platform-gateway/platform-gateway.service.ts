import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGatewayProvider } from "@prisma/client";
import { BankTransferGatewayAdapter } from "../payment-gateway/adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "../payment-gateway/adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "../payment-gateway/adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "../payment-gateway/adapters/raast-gateway.adapter";
import { decryptGatewayCredential, encryptGatewayCredential } from "../payment-gateway/payment-gateway-credential-crypto.util";
import { GatewayVerifyResult, SellerPaymentGatewayAdapter } from "../payment-gateway/seller-payment-gateway-adapter.interface";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

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
 */
@Injectable()
export class PlatformGatewayService {
  private readonly encryptionKey: Buffer;
  private readonly adapters: Map<PaymentGatewayProvider, SellerPaymentGatewayAdapter>;

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
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
   * fall back to the manual flow" (no active connection for ANY provider),
   * never thrown as an error. When multiple providers are active
   * simultaneously (unusual but not prevented), the same Raast-first
   * priority order the seller-side checkout list uses picks which one
   * attempts the charge.
   */
  async tryAutoVerify(orderRef: string, amount: number, currency: string, reference?: string): Promise<GatewayVerifyResult | null> {
    const active = await this.prismaAdmin.platformGatewayConnection.findMany({ where: { isActive: true } });
    if (active.length === 0) return null;

    const connection = [...active].sort((a, b) => PROVIDER_PRIORITY[a.provider] - PROVIDER_PRIORITY[b.provider])[0];
    if (!connection.apiKeyEncrypted) return null;

    const adapter = this.adapters.get(connection.provider);
    if (!adapter) return null;

    const result = await adapter.verifyPayment({
      connection: {
        merchantId: connection.merchantId,
        apiKey: decryptGatewayCredential(connection.apiKeyEncrypted, this.encryptionKey),
        apiSecret: connection.apiSecretEncrypted ? decryptGatewayCredential(connection.apiSecretEncrypted, this.encryptionKey) : null,
      },
      orderId: orderRef,
      amount,
      currency,
      reference,
    });

    await this.prismaAdmin.platformGatewayConnection.update({
      where: { id: connection.id },
      data: result.verified
        ? { verifiedCount: { increment: 1 }, lastVerifiedAt: new Date() }
        : { failedCount: { increment: 1 }, lastFailedAt: new Date() },
    });

    return result;
  }
}
