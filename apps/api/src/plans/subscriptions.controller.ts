import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { SellerAgreementGuard } from "../trust-safety/seller-agreement.guard";
import { ChangePlanDto } from "./dto/change-plan.dto";
import { RedeemPromoCodeDto } from "./dto/redeem-promo-code.dto";
import { PromoCodesService } from "./promo-codes.service";
import { SubscriptionsService } from "./subscriptions.service";

/** SRS §5.7 (FR-7.5/7.9) - a seller's own plan/billing self-service surface. */
@Controller("sellers/me/subscription")
@UseGuards(SellerAgreementGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly promoCodes: PromoCodesService,
  ) {}

  @Get()
  get(@CurrentSellerId() sellerId: string) {
    return this.subscriptions.getSubscription(sellerId);
  }

  @Post("change")
  change(@CurrentSellerId() sellerId: string, @Body() dto: ChangePlanDto) {
    return this.subscriptions.requestPlanChange(sellerId, dto.planId);
  }

  @Post("redeem-promo")
  redeemPromo(@CurrentSellerId() sellerId: string, @Body() dto: RedeemPromoCodeDto) {
    return this.promoCodes.redeem(sellerId, dto.code);
  }
}
