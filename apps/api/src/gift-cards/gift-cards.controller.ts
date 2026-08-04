import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { IssueGiftCardDto } from "./dto/issue-gift-card.dto";
import { GiftCardsService } from "./gift-cards.service";

@Controller("stores/:storeId/gift-cards")
@UseGuards(JwtAuthGuard)
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Post()
  issue(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: IssueGiftCardDto) {
    return this.giftCards.issue(sellerId, storeId, dto);
  }

  @Get()
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.giftCards.list(sellerId, storeId);
  }

  @Get(":giftCardId")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("giftCardId") giftCardId: string) {
    return this.giftCards.getOne(sellerId, storeId, giftCardId);
  }

  /** FR-49.3 - the Direct Seller Collection confirm-payment action for a buyer-purchased card. */
  @Post(":giftCardId/confirm-paid")
  confirmPaid(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("giftCardId") giftCardId: string,
  ) {
    return this.giftCards.confirmPurchasePaid(sellerId, storeId, giftCardId);
  }
}
