import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { MrrAnalyticsService } from "./mrr-analytics.service";
import { SellerHealthFunnelService } from "./seller-health-funnel.service";
import { UnitEconomicsService } from "./unit-economics.service";

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

  @Get()
  get() {
    return this.unitEconomics.computeRealTimeAnalytics();
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
}
