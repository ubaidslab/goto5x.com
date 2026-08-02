import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { EmailOtpAdapter } from "./adapters/email-otp.adapter";
import { PrepaidConfirmationAdapter } from "./adapters/prepaid-confirmation.adapter";
import { WhatsAppOtpAdapter } from "./adapters/whatsapp-otp.adapter";
import { BuyerOrderVerificationController } from "./buyer-order-verification.controller";
import { OrderVerificationService } from "./order-verification.service";
import {
  SellerOrderVerificationController,
  SellerVerificationEmailsController,
  StoreVerificationSettingsController,
} from "./seller-verification.controller";
import { SellerVerificationEmailsService } from "./seller-verification-emails.service";

/**
 * Module 26 (SRS §3.5, §5.37) - dedicated top-level directory matching the
 * precedent of store-health/trust-safety for a substantial standalone
 * feature. Exports OrderVerificationService for CheckoutService/
 * OrdersService (task #254) to gate the pending -> confirmed transition on.
 */
@Module({
  imports: [SettingsModule],
  controllers: [
    BuyerOrderVerificationController,
    SellerVerificationEmailsController,
    SellerOrderVerificationController,
    StoreVerificationSettingsController,
  ],
  providers: [
    WhatsAppOtpAdapter,
    EmailOtpAdapter,
    PrepaidConfirmationAdapter,
    SellerVerificationEmailsService,
    OrderVerificationService,
  ],
  exports: [OrderVerificationService],
})
export class OrderVerificationModule {}
