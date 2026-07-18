import { Module } from "@nestjs/common";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { DiscountCodesController } from "./discount-codes.controller";
import { DiscountCodesService } from "./discount-codes.service";
import { PaymentInstructionsController } from "./payment-instructions.controller";
import { PaymentInstructionsService } from "./payment-instructions.service";
import { ShippingSettingsController } from "./shipping-settings.controller";
import { ShippingSettingsService } from "./shipping-settings.service";
import { TaxSettingsController } from "./tax-settings.controller";
import { TaxSettingsService } from "./tax-settings.service";

@Module({
  imports: [TrustSafetyModule],
  controllers: [ShippingSettingsController, TaxSettingsController, DiscountCodesController, PaymentInstructionsController],
  providers: [ShippingSettingsService, TaxSettingsService, DiscountCodesService, PaymentInstructionsService],
  exports: [ShippingSettingsService, TaxSettingsService, DiscountCodesService, PaymentInstructionsService],
})
export class StoreSettingsModule {}
