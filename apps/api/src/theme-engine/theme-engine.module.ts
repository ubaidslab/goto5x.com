import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { BillingModule } from "../billing/billing.module";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminTemplatePurchasesController } from "./admin-template-purchases.controller";
import { StoreThemeSettingsController } from "./store-theme-settings.controller";
import { StoreThemeSettingsService } from "./store-theme-settings.service";
import { TemplatePurchaseController } from "./template-purchase.controller";
import { TemplatePurchaseService } from "./template-purchase.service";
import { ThemesController } from "./themes.controller";
import { ThemesService } from "./themes.service";

@Module({
  imports: [SettingsModule, PlansModule, AdminModule, BillingModule],
  controllers: [ThemesController, StoreThemeSettingsController, TemplatePurchaseController, AdminTemplatePurchasesController],
  providers: [ThemesService, StoreThemeSettingsService, TemplatePurchaseService],
  exports: [ThemesService, StoreThemeSettingsService],
})
export class ThemeEngineModule {}
