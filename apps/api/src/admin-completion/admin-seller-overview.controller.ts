import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { AdminSellerOverviewService } from "./admin-seller-overview.service";

/** Module 25 (Admin Completion) - the seller-360 page: one aggregated read across every module that holds this seller's data. */
@Controller("admin/sellers")
@UseGuards(AdminAuthGuard)
export class AdminSellerOverviewController {
  constructor(private readonly overview: AdminSellerOverviewService) {}

  @Get(":sellerId/overview")
  get(@Param("sellerId") sellerId: string) {
    return this.overview.getOverview(sellerId);
  }
}
