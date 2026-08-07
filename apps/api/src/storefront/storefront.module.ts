import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { BrandingModule } from "../branding/branding.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { StorefrontController } from "./storefront.controller";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [SettingsModule, JwtModule.register({}), BrandingModule],
  controllers: [StorefrontController],
  providers: [StorefrontService, RateLimitService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
