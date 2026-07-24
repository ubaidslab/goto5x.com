import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { AdminOverviewService } from "./admin-overview.service";

/** Module 25 (Admin Completion) - the admin HOME page: today's numbers + every pending-queue count, one click from each. */
@Controller("admin/overview")
@UseGuards(AdminAuthGuard)
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get()
  get() {
    return this.overview.getOverview();
  }
}
