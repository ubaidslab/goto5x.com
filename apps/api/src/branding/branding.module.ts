import { Module } from "@nestjs/common";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { BrandingController } from "./branding.controller";
import { BrandingService } from "./branding.service";

@Module({
  imports: [SettingsModule, PlansModule],
  controllers: [BrandingController],
  providers: [BrandingService],
  exports: [BrandingService],
})
export class BrandingModule {}
