import { Module } from "@nestjs/common";
import { DiscountCodesController } from "./discount-codes.controller";
import { DiscountCodesService } from "./discount-codes.service";
import { ShippingSettingsController } from "./shipping-settings.controller";
import { ShippingSettingsService } from "./shipping-settings.service";
import { TaxSettingsController } from "./tax-settings.controller";
import { TaxSettingsService } from "./tax-settings.service";

@Module({
  controllers: [ShippingSettingsController, TaxSettingsController, DiscountCodesController],
  providers: [ShippingSettingsService, TaxSettingsService, DiscountCodesService],
  exports: [ShippingSettingsService, TaxSettingsService, DiscountCodesService],
})
export class StoreSettingsModule {}
