import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { RequireStaffScope } from "../common/decorators/require-staff-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { StaffScopeGuard } from "../common/guards/staff-scope.guard";
import { IssueGiftCardDto } from "./dto/issue-gift-card.dto";
import { GiftCardsService } from "./gift-cards.service";

/** SRS §5.52/FR-52.7-52.8 (Module 97) - a staff session needs the `marketing` scope. */
@Controller("stores/:storeId/gift-cards")
@UseGuards(JwtAuthGuard, StaffScopeGuard)
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Post()
  @RequireStaffScope("marketing")
  issue(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Body() dto: IssueGiftCardDto) {
    return this.giftCards.issue(sellerId, storeId, dto);
  }

  @Get()
  @RequireStaffScope("marketing", "read")
  list(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.giftCards.list(sellerId, storeId);
  }

  @Get(":giftCardId")
  @RequireStaffScope("marketing", "read")
  getOne(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string, @Param("giftCardId") giftCardId: string) {
    return this.giftCards.getOne(sellerId, storeId, giftCardId);
  }

  /** FR-49.3 - the Direct Seller Collection confirm-payment action for a buyer-purchased card. */
  @Post(":giftCardId/confirm-paid")
  @RequireStaffScope("marketing")
  confirmPaid(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("giftCardId") giftCardId: string,
  ) {
    return this.giftCards.confirmPurchasePaid(sellerId, storeId, giftCardId);
  }
}
