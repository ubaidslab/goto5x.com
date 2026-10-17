import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { MessagingModule } from "../messaging/messaging.module";
import { BankTransferGatewayAdapter } from "./adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "./adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "./adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "./adapters/raast-gateway.adapter";
import { StripeGatewayAdapter } from "./adapters/stripe-gateway.adapter";
import { BuyerPaymentGatewayController } from "./buyer-payment-gateway.controller";
import { GatewayCredentialVaultService } from "./gateway-credential-vault.service";
import { PaymentGatewayController } from "./payment-gateway.controller";
import { PaymentGatewayService } from "./payment-gateway.service";
import { GatewayHealthService } from "./gateway-health.service";
import { GatewayHealthScheduler } from "./gateway-health.scheduler";
import { RestrictedKeyCredentialSource } from "./stripe/restricted-key-credential-source";
import { STRIPE_CREDENTIAL_SOURCE } from "./stripe/stripe-credential-source.interface";
import { StripeWebhookController } from "./webhooks/stripe-webhook.controller";
import { WebhookEventDedupeService } from "./webhooks/webhook-event-dedupe.service";

/**
 * Module 62 (SRS §3.5-style dedicated top-level directory, §5.6h) -
 * imports OrdersModule for OrdersService.markAsPaid(), the single shared
 * confirmation core FR-6.38 requires this module reuse rather than
 * duplicate. No reverse dependency exists (OrdersModule never needs
 * PaymentGatewayModule), so this import direction is acyclic.
 */
@Module({
  imports: [OrdersModule, SettingsModule, MessagingModule],
  controllers: [PaymentGatewayController, BuyerPaymentGatewayController, StripeWebhookController],
  providers: [
    RaastGatewayAdapter,
    EasypaisaGatewayAdapter,
    JazzCashGatewayAdapter,
    BankTransferGatewayAdapter,
    StripeGatewayAdapter,
    { provide: STRIPE_CREDENTIAL_SOURCE, useClass: RestrictedKeyCredentialSource },
    GatewayCredentialVaultService,
    WebhookEventDedupeService,
    PaymentGatewayService,
    GatewayHealthService,
    GatewayHealthScheduler,
  ],
  exports: [PaymentGatewayService, GatewayHealthService],
})
export class PaymentGatewayModule {}
