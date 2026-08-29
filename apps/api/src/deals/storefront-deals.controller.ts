import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { DealsService } from "./deals.service";
import { BuyNowDto } from "./dto/buy-now.dto";

/** SRS §5.67/FR-67.3 - public, unauthenticated deal listing/detail/buy-now, same pre-auth shape as StorefrontGiftCardsController. */
@Controller("storefront/deals")
export class StorefrontDealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  list(@Query("hostname") hostname: string) {
    return this.deals.listActive(hostname);
  }

  @Get(":dealId")
  getOne(@Param("dealId") dealId: string, @Query("hostname") hostname: string) {
    return this.deals.getActiveOne(hostname, dealId);
  }

  @Post(":dealId/buy-now")
  buyNow(@Param("dealId") dealId: string, @Body() dto: BuyNowDto, @Req() req: Request) {
    return this.deals.buyNow(dealId, dto, req.ip ?? "unknown");
  }
}
