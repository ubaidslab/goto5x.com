import { Module } from "@nestjs/common";
import { StorefrontModule } from "../storefront/storefront.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { GiftCardsController } from "./gift-cards.controller";
import { GiftCardsService } from "./gift-cards.service";
import { StorefrontGiftCardsController } from "./storefront-gift-cards.controller";

@Module({
  imports: [StorefrontModule, SettingsModule],
  controllers: [GiftCardsController, StorefrontGiftCardsController],
  providers: [GiftCardsService, RateLimitService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
