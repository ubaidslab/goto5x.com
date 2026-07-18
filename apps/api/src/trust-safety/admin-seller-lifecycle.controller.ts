import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { $Enums } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { SetLifecycleStatusDto } from "./dto/set-lifecycle-status.dto";
import { SellerLifecycleService } from "./seller-lifecycle.service";

/**
 * SRS §5.29/FR-29.4 - the T&S enforcement ladder's admin surface, built on
 * FR-8.4's seller-lifecycle control. Deliberately NOT `@AllowReviewer()` -
 * this is more sensitive than listing-content moderation (it acts on a
 * seller's whole account, not one product), so it stays `super_admin`/
 * `support` only, same discipline as the settings/audit-log admin routes.
 */
@Controller("admin/sellers")
@UseGuards(AdminAuthGuard)
export class AdminSellerLifecycleController {
  constructor(private readonly lifecycle: SellerLifecycleService) {}

  @Get()
  list(@Query("lifecycleStatus") lifecycleStatus: $Enums.SellerLifecycleStatus) {
    return this.lifecycle.listBySellerLifecycleStatus(lifecycleStatus);
  }

  @Post(":sellerId/activation/approve")
  approveActivation(@CurrentUser() user: JwtAccessPayload, @Param("sellerId") sellerId: string) {
    this.assertAdminUserId(user);
    return this.lifecycle.approveActivation(user.adminUserId, sellerId);
  }

  @Post(":sellerId/lifecycle")
  setLifecycleStatus(
    @CurrentUser() user: JwtAccessPayload,
    @Param("sellerId") sellerId: string,
    @Body() dto: SetLifecycleStatusDto,
  ) {
    this.assertAdminUserId(user);
    return this.lifecycle.setLifecycleStatus(user.adminUserId, sellerId, dto.status, dto.reason);
  }

  private assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
    if (!user.adminUserId) {
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
  }
}
