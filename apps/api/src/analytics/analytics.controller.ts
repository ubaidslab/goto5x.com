import { BadRequestException, Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";
import { SalesBucket } from "./analytics.util";

const VALID_BUCKETS: SalesBucket[] = ["day", "week", "month"];

@Controller("stores/:storeId/analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("top-products")
  getTopProducts(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Query("by") by?: string,
    @Query("limit") limit?: string,
  ) {
    const metric = by === "units" ? "units" : "revenue";
    const parsedLimit = limit ? Number(limit) : 10;
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new BadRequestException("limit must be an integer between 1 and 100.");
    }
    return this.analytics.getTopProducts(sellerId, storeId, metric, parsedLimit);
  }

  @Get("sales-over-time")
  getSalesOverTime(
    @CurrentSellerId() sellerId: string,
    @Param("storeId") storeId: string,
    @Query("bucket") bucket?: string,
    @Query("start") start?: string,
    @Query("end") end?: string,
  ) {
    const resolvedBucket = VALID_BUCKETS.includes(bucket as SalesBucket) ? (bucket as SalesBucket) : "day";
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 30);
    const startDate = start ? new Date(start) : defaultStart;
    const endDate = end ? new Date(end) : now;
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("start/end must be valid dates.");
    }
    if (startDate > endDate) {
      throw new BadRequestException("start must not be after end.");
    }
    return this.analytics.getSalesOverTime(sellerId, storeId, resolvedBucket, startDate, endDate);
  }

  @Get("overview")
  getOverview(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.analytics.getOverview(sellerId, storeId);
  }

  @Get("return-rate-by-product")
  getReturnRateByProduct(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.analytics.getReturnRateByProduct(sellerId, storeId);
  }

  @Get("deal-performance")
  getDealPerformance(@CurrentSellerId() sellerId: string, @Param("storeId") storeId: string) {
    return this.analytics.getDealPerformance(sellerId, storeId);
  }
}
