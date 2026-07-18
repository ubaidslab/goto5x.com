import { Module } from "@nestjs/common";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { StoreThemeSettingsController } from "./store-theme-settings.controller";
import { StoreThemeSettingsService } from "./store-theme-settings.service";
import { ThemesController } from "./themes.controller";
import { ThemesService } from "./themes.service";

@Module({
  imports: [SettingsModule, PlansModule],
  controllers: [ThemesController, StoreThemeSettingsController],
  providers: [ThemesService, StoreThemeSettingsService],
  exports: [ThemesService, StoreThemeSettingsService],
})
export class ThemeEngineModule {}
