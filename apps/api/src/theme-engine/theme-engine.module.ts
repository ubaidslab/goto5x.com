import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { BillingModule } from "../billing/billing.module";
import { PlansModule } from "../plans/plans.module";
import { PlatformGatewayModule } from "../platform-gateway/platform-gateway.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminDstudioPackController } from "./admin-dstudio-pack.controller";
import { AdminTemplatePurchasesController } from "./admin-template-purchases.controller";
import { DstudioPackController } from "./dstudio-pack.controller";
import { DstudioPackService } from "./dstudio-pack.service";
import { StoreThemeSettingsController } from "./store-theme-settings.controller";
import { StoreThemeSettingsService } from "./store-theme-settings.service";
import { TemplatePurchaseController } from "./template-purchase.controller";
import { TemplatePurchaseService } from "./template-purchase.service";
import { ThemesController } from "./themes.controller";
import { ThemesService } from "./themes.service";

@Module({
  imports: [SettingsModule, PlansModule, AdminModule, BillingModule, PlatformGatewayModule],
  controllers: [
    ThemesController,
    StoreThemeSettingsController,
    TemplatePurchaseController,
    AdminTemplatePurchasesController,
    DstudioPackController,
    AdminDstudioPackController,
  ],
  providers: [ThemesService, StoreThemeSettingsService, TemplatePurchaseService, DstudioPackService],
  exports: [ThemesService, StoreThemeSettingsService],
})
export class ThemeEngineModule {}
