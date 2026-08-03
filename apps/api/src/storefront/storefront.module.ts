import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { BrandingModule } from "../branding/branding.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { StorefrontController } from "./storefront.controller";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [SettingsModule, JwtModule.register({}), BrandingModule],
  controllers: [StorefrontController],
  providers: [StorefrontService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
