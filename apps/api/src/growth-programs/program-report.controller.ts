import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ReferralProgramType } from "@prisma/client";
import { AllowReviewer } from "../common/decorators/allow-reviewer.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { ProgramReportService } from "./program-report.service";

/** FR-33.11 - "a per-program report (referrals, conversions, payouts, rejection rate)." Read-only, no money movement - reviewer-accessible. */
@Controller("admin/growth-programs/reports")
@UseGuards(AdminAuthGuard)
@AllowReviewer()
export class AdminProgramReportController {
  constructor(private readonly reports: ProgramReportService) {}

  @Get(":programType")
  report(@Param("programType") programType: ReferralProgramType) {
    return this.reports.report(programType);
  }
}
