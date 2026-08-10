import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGatewayProvider } from "@prisma/client";
import { OrdersService } from "../orders/orders.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { BankTransferGatewayAdapter } from "./adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "./adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "./adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "./adapters/raast-gateway.adapter";
import { decryptGatewayCredential, encryptGatewayCredential } from "./payment-gateway-credential-crypto.util";
import { SellerPaymentGatewayAdapter } from "./seller-payment-gateway-adapter.interface";

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
    const [connection, order, store] = await Promise.all([
      this.prismaAdmin.storePaymentGatewayConnection.findUnique({
        where: { uniq_store_gateway_provider: { storeId, provider } },
      }),
      this.prismaAdmin.order.findUnique({ where: { id: orderId } }),
      this.prismaAdmin.store.findUnique({ where: { id: storeId } }),
    ]);
    if (!connection || !connection.isActive || connection.storeId !== storeId) {
      throw new NotFoundException("No active connection for this provider.");
    }
    if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
    if (!store) throw new NotFoundException("Store not found.");
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
      amount: Number(order.totalAmount),
      currency: order.currency,
      reference,
    });
    if (!result.verified) {
      throw new BadRequestException("Payment could not be verified with this provider yet.");
    }

    return this.orders.markAsPaid(store.sellerId, storeId, orderId);
  }
}
