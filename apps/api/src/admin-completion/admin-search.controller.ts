import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { AdminSearchService } from "./admin-search.service";

/** Module 25 (Admin Completion) - global search by partial name/email/ID across sellers/stores/orders/suppliers. */
@Controller("admin/search")
@UseGuards(AdminAuthGuard)
export class AdminSearchController {
  constructor(private readonly search: AdminSearchService) {}

  @Get()
  get(@Query("q") q = "") {
    return this.search.search(q);
  }
}
