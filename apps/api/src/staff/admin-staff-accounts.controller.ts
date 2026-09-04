import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { BlockStaffAccountDto } from "./dto/block-staff-account.dto";
import { SuspendStaffAccountDto } from "./dto/suspend-staff-account.dto";
import { StaffAccountsService } from "./staff-accounts.service";

/** FR-52.14/FR-52.15 (Module 101, founder batch B14) - admin-only lifecycle actions on a seller's staff accounts, a route that never existed before this FR. */
@Controller("admin/sellers/:sellerId/staff-accounts")
@UseGuards(AdminAuthGuard)
export class AdminStaffAccountsController {
  constructor(private readonly staffAccounts: StaffAccountsService) {}

  @Get()
  list(@Param("sellerId") sellerId: string) {
    return this.staffAccounts.listForAdmin(sellerId);
  }

  @Post(":id/suspend")
  suspend(@Param("sellerId") sellerId: string, @Param("id") id: string, @Body() dto: SuspendStaffAccountDto, @CurrentUser() user: JwtAccessPayload) {
    return this.staffAccounts.suspend(user.adminUserId!, sellerId, id, new Date(dto.until), dto.reason);
  }

  @Post(":id/block")
  block(@Param("sellerId") sellerId: string, @Param("id") id: string, @Body() dto: BlockStaffAccountDto, @CurrentUser() user: JwtAccessPayload) {
    return this.staffAccounts.block(user.adminUserId!, sellerId, id, dto.reason);
  }

  @Post(":id/reactivate")
  reactivate(@Param("sellerId") sellerId: string, @Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    return this.staffAccounts.reactivate(user.adminUserId!, sellerId, id);
  }

  @Post(":id/reset-password")
  resetPassword(@Param("sellerId") sellerId: string, @Param("id") id: string, @CurrentUser() user: JwtAccessPayload) {
    return this.staffAccounts.triggerPasswordReset(user.adminUserId!, sellerId, id);
  }
}
