import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
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
  constructor(private readonly unitEconomics: UnitEconomicsService) {}

  @Get()
  get() {
    return this.unitEconomics.computeRealTimeAnalytics();
  }
}
