import { Body, Controller, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { PurchaseGiftCardDto } from "./dto/purchase-gift-card.dto";
import { GiftCardsService } from "./gift-cards.service";

/** Public, unauthenticated - completes into a `pending_payment` gift card (FR-49.2/49.3). */
@Controller("storefront/gift-cards")
export class StorefrontGiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Post("purchase")
  purchase(@Body() dto: PurchaseGiftCardDto, @Req() req: Request) {
    return this.giftCards.purchase(dto, req.ip ?? "unknown");
  }
}
