import { Module } from "@nestjs/common";
import { StorefrontModule } from "../storefront/storefront.module";
import { GiftCardsController } from "./gift-cards.controller";
import { GiftCardsService } from "./gift-cards.service";
import { StorefrontGiftCardsController } from "./storefront-gift-cards.controller";

@Module({
  imports: [StorefrontModule],
  controllers: [GiftCardsController, StorefrontGiftCardsController],
  providers: [GiftCardsService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
