import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { SalesBucket } from "../analytics/analytics.util";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { MrrAnalyticsService } from "./mrr-analytics.service";
import { SellerHealthFunnelService } from "./seller-health-funnel.service";
import { UnitEconomicsService } from "./unit-economics.service";

const VALID_BUCKETS: SalesBucket[] = ["day", "week", "month"];

/**
 * FR-8.19 - a caller-supplied `end` is a bare date ("2026-09-03" from an
 * `<input type="date">`), which `new Date()` parses as that day's UTC
 * midnight - a `lte` filter against it would exclude everything from later
 * that same day, so "To: today" would silently show none of today's data.
 * Pushed to the last instant of that UTC day so "To: today" means through
 * today, not "before today started."
 */
function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

/** SRS §5.23/FR-23.4 - unit-economics data (free-vs-paid split, break-even). */
@Controller("admin/unit-economics")
@UseGuards(AdminAuthGuard)
export class AdminUnitEconomicsController {
  constructor(private readonly unitEconomics: UnitEconomicsService) {}

  @Get()
  get() {
    return this.unitEconomics.computeSummary();
  }
}

/** SRS FR-8.10 - real-time platform analytics, built Module 17 (was data-only via UnitEconomicsService until now). */
@Controller("admin/analytics")
@UseGuards(AdminAuthGuard)
export class AdminAnalyticsController {
  constructor(
    private readonly unitEconomics: UnitEconomicsService,
    private readonly mrrAnalytics: MrrAnalyticsService,
    private readonly sellerHealthFunnel: SellerHealthFunnelService,
  ) {}

  /** SRS FR-8.19 (Module 98) - start/end optional; omitted, every figure is all-time (unchanged from before this FR). */
  @Get()
  get(@Query("start") start?: string, @Query("end") end?: string) {
    const { startDate, endDate } = this.parseOptionalRange(start, end);
    return this.unitEconomics.computeRealTimeAnalytics(startDate, endDate);
  }

  /** SRS FR-8.19 (Module 98) - platform-wide sales-over-time, mirroring FR-61.2's seller-facing query shape exactly. */
  @Get("sales-over-time")
  getSalesOverTime(@Query("bucket") bucket?: string, @Query("start") start?: string, @Query("end") end?: string) {
    const resolvedBucket = VALID_BUCKETS.includes(bucket as SalesBucket) ? (bucket as SalesBucket) : "day";
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 30);
    const startDate = start ? new Date(start) : defaultStart;
    const endDate = end ? endOfUtcDay(new Date(end)) : now;
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("start/end must be valid dates.");
    }
    if (startDate > endDate) {
      throw new BadRequestException("start must not be after end.");
    }
    return this.unitEconomics.getSalesOverTime(resolvedBucket, startDate, endDate);
  }

  /** SRS §5.6k/FR-6.40 (Module 63) - MRR analytics, on this same admin analytics surface. */
  @Get("mrr")
  getMrr() {
    return this.mrrAnalytics.compute();
  }

  /** SRS §5.6k/FR-6.46 (Module 69) - seller health funnel, on this same admin analytics surface. */
  @Get("seller-funnel")
  getSellerFunnel() {
    return this.sellerHealthFunnel.compute();
  }

  /** FR-8.19 - both-or-neither: a lone start or end would silently compute an unbounded range on one side, which is worse than rejecting it outright. */
  private parseOptionalRange(start?: string, end?: string): { startDate?: Date; endDate?: Date } {
    if (!start && !end) return {};
    if (!start || !end) {
      throw new BadRequestException("start and end must both be provided, or neither.");
    }
    const startDate = new Date(start);
    const endDate = endOfUtcDay(new Date(end));
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("start/end must be valid dates.");
    }
    if (startDate > endDate) {
      throw new BadRequestException("start must not be after end.");
    }
    return { startDate, endDate };
  }
}
