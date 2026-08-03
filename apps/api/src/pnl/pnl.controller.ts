import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateAdSpendEntryDto } from "./dto/create-ad-spend-entry.dto";
import { PnLService } from "./pnl.service";

@Controller("stores/:storeId/pnl")
@UseGuards(JwtAuthGuard)
export class PnLController {
  constructor(private readonly pnl: PnLService) {}

  @Get("orders/:orderId")
  getOrderProfit(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.pnl.getOrderProfit(sellerId, storeId, orderId);
  }

  @Get("period")
  getPeriodProfit(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Query("periodStart") periodStart: string,
    @Query("periodEnd") periodEnd: string,
  ) {
    return this.pnl.getPeriodProfit(sellerId, storeId, periodStart, periodEnd);
  }

  @Get("ad-spend")
  listAdSpendEntries(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.pnl.listAdSpendEntries(sellerId, storeId);
  }

  @Post("ad-spend")
  createAdSpendEntry(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Body() dto: CreateAdSpendEntryDto,
  ) {
    return this.pnl.createAdSpendEntry(sellerId, storeId, dto);
  }
}
