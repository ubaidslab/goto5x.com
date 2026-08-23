import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentGatewayProvider } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { EmailService } from "../notifications/email.service";
import { PlatformMessagesService } from "../messaging/platform-messages.service";
import { round2 } from "../orders/money.util";
import { BankTransferGatewayAdapter } from "./adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "./adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "./adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "./adapters/raast-gateway.adapter";
import { decryptGatewayCredential } from "./payment-gateway-credential-crypto.util";
import { SellerPaymentGatewayAdapter } from "./seller-payment-gateway-adapter.interface";

const ALL_PROVIDERS: PaymentGatewayProvider[] = ["raast", "easypaisa", "jazzcash", "bank"];

const PROVIDER_LABEL: Record<PaymentGatewayProvider, string> = {
  raast: "Raast",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  bank: "Bank transfer",
};

export interface ProviderHealthRollup {
  provider: PaymentGatewayProvider;
  verifiedCount: number;
  failedCount: number;
  /** null when there's no data yet (never checked). */
  successRatePercent: number | null;
  lastVerifiedAt: Date | null;
  lastFailedAt: Date | null;
}

/**
 * SRS §5.6k/FR-6.44 (Module 67) - payment gateway health monitoring.
 * Two feeds into the same per-connection rolling counters
 * (StorePaymentGatewayConnection.verifiedCount/failedCount/lastVerifiedAt/
 * lastFailedAt/lastCheckedAt): (a) PaymentGatewayService.chargeViaGateway()
 * calls recordResult() after every real checkout verification, immediately;
 * (b) runHealthCheckSweep() (the 6-hourly scheduled job) pings every active
 * connection itself with a lightweight testMode call, the same mechanism
 * FR-6.39's seller-facing testConnection() already uses. The alert
 * threshold check/send only ever runs from the sweep, never per-checkout-
 * call - alerting on every single failed order would spam a seller the
 * moment a provider blips, not just when it's genuinely degraded.
 */
@Injectable()
export class GatewayHealthService {
  private readonly encryptionKey: Buffer;
  private readonly adapters: Map<PaymentGatewayProvider, SellerPaymentGatewayAdapter>;

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly email: EmailService,
    private readonly platformMessages: PlatformMessagesService,
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

  /** Called by PaymentGatewayService.chargeViaGateway() after every real checkout verification - "the instant it happens" (FR-6.44). */
  async recordResult(connectionId: string, verified: boolean, now = new Date()): Promise<void> {
    await this.prismaAdmin.storePaymentGatewayConnection.update({
      where: { id: connectionId },
      data: {
        verifiedCount: verified ? { increment: 1 } : undefined,
        failedCount: !verified ? { increment: 1 } : undefined,
        lastVerifiedAt: verified ? now : undefined,
        lastFailedAt: !verified ? now : undefined,
        lastCheckedAt: now,
      },
    });
  }

  /** The 6-hourly scheduled sweep: pings every active connection, then evaluates/sends the per-provider degradation alert. */
  async runHealthCheckSweep(now = new Date()): Promise<{ checked: number; alertedProviders: PaymentGatewayProvider[] }> {
    const connections = await this.prismaAdmin.storePaymentGatewayConnection.findMany({
      where: { isActive: true, apiKeyEncrypted: { not: null } },
    });

    let checked = 0;
    for (const connection of connections) {
      const adapter = this.adapters.get(connection.provider);
      if (!adapter) continue;
      let verified = false;
      try {
        const result = await adapter.verifyPayment({
          connection: {
            merchantId: connection.merchantId,
            apiKey: decryptGatewayCredential(connection.apiKeyEncrypted!, this.encryptionKey),
            apiSecret: connection.apiSecretEncrypted ? decryptGatewayCredential(connection.apiSecretEncrypted, this.encryptionKey) : null,
          },
          orderId: "",
          amount: 0,
          currency: "",
          testMode: true,
        });
        verified = result.verified;
      } catch {
        verified = false;
      }
      await this.recordResult(connection.id, verified, now);
      checked += 1;
    }

    const alertedProviders: PaymentGatewayProvider[] = [];
    const threshold = await this.settings.resolve<number>("billing.gateway_health_alert_threshold_percent");
    for (const provider of ALL_PROVIDERS) {
      const rollup = await this.computeProviderRollup(provider);
      const state = await this.prismaAdmin.paymentGatewayHealthAlert.findUnique({ where: { provider } });
      const degraded = rollup.successRatePercent !== null && rollup.successRatePercent < threshold;

      if (degraded && !state?.alertedAt) {
        await this.alertSellersForProvider(provider);
        await this.prismaAdmin.paymentGatewayHealthAlert.upsert({
          where: { provider },
          create: { provider, alertedAt: now },
          update: { alertedAt: now },
        });
        alertedProviders.push(provider);
      } else if (!degraded && state?.alertedAt) {
        await this.prismaAdmin.paymentGatewayHealthAlert.update({ where: { provider }, data: { alertedAt: null } });
      }
    }

    return { checked, alertedProviders };
  }

  /** Admin System Status page (FR-8.11/FR-6.44) - every provider, connected or not, so the list is stable across page loads. */
  async getProviderRollup(): Promise<ProviderHealthRollup[]> {
    return Promise.all(ALL_PROVIDERS.map((provider) => this.computeProviderRollup(provider)));
  }

  private async computeProviderRollup(provider: PaymentGatewayProvider): Promise<ProviderHealthRollup> {
    const agg = await this.prismaAdmin.storePaymentGatewayConnection.aggregate({
      where: { provider, isActive: true },
      _sum: { verifiedCount: true, failedCount: true },
      _max: { lastVerifiedAt: true, lastFailedAt: true },
    });
    const verifiedCount = agg._sum.verifiedCount ?? 0;
    const failedCount = agg._sum.failedCount ?? 0;
    const total = verifiedCount + failedCount;
    return {
      provider,
      verifiedCount,
      failedCount,
      successRatePercent: total > 0 ? round2((verifiedCount / total) * 100) : null,
      lastVerifiedAt: agg._max.lastVerifiedAt,
      lastFailedAt: agg._max.lastFailedAt,
    };
  }

  /** One email + one dashboard banner per distinct seller with an active connection to this provider (never one per store - a seller with several connected stores gets exactly one of each). */
  private async alertSellersForProvider(provider: PaymentGatewayProvider): Promise<void> {
    const connections = await this.prismaAdmin.storePaymentGatewayConnection.findMany({
      where: { provider, isActive: true },
      include: { store: { include: { seller: { include: { user: { select: { email: true } } } } } } },
    });

    const alertedSellerIds = new Set<string>();
    const label = PROVIDER_LABEL[provider];
    for (const connection of connections) {
      const sellerId = connection.store.sellerId;
      if (alertedSellerIds.has(sellerId)) continue;
      alertedSellerIds.add(sellerId);

      await this.email.sendGatewayHealthAlertEmail(connection.store.seller.user.email, label);
      await this.platformMessages.createSystemBanner(
        sellerId,
        `${label} payments degraded`,
        `We're seeing a higher-than-normal failure rate verifying ${label} payments right now. Checkout automatically falls back to manual/COD confirmation, so orders keep coming through - no action needed on your end.`,
      );
    }
  }
}
