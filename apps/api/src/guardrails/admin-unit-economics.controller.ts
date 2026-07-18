import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { UnitEconomicsService } from "./unit-economics.service";

/**
 * SRS §5.23/FR-23.4 - data only, no dashboard UI (that's FR-8.10's job,
 * Module 17 - see docs/build-plan.md's Module 14 note for the disclosed
 * scope decision). Exposed now so that future screen has something to
 * call.
 */
@Controller("admin/unit-economics")
@UseGuards(AdminAuthGuard)
export class AdminUnitEconomicsController {
  constructor(private readonly unitEconomics: UnitEconomicsService) {}

  @Get()
  get() {
    return this.unitEconomics.computeSummary();
  }
}
