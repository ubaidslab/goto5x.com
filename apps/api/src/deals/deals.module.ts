import { Module } from "@nestjs/common";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { StorefrontModule } from "../storefront/storefront.module";
import { DealsController } from "./deals.controller";
import { DealsService } from "./deals.service";
import { StorefrontDealsController } from "./storefront-deals.controller";

@Module({
  imports: [StorefrontModule, SettingsModule],
  controllers: [DealsController, StorefrontDealsController],
  providers: [DealsService, RateLimitService],
  exports: [DealsService],
})
export class DealsModule {}
