import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AllowReviewer } from "../common/decorators/allow-reviewer.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { ApproveProductDto } from "./dto/approve-product.dto";
import { RejectProductDto } from "./dto/reject-product.dto";
import { ModerationService } from "./moderation.service";

/**
 * SRS §4/FR-27.6 - the one admin surface the REVIEWER sub-role can reach
 * (`@AllowReviewer()` on every route here). `super_admin`/`support` can
 * reach this too, same as any other admin route.
 */
@Controller("admin/moderation")
@UseGuards(AdminAuthGuard)
@AllowReviewer()
export class ModerationQueueController {
  constructor(private readonly moderation: ModerationService) {}

  @Get("queue")
  listQueue() {
    return this.moderation.listQueue();
  }

  @Post("queue/:productId/approve")
  approve(
    @CurrentUser() user: JwtAccessPayload,
    @Param("productId") productId: string,
    @Body() dto: ApproveProductDto,
  ) {
    this.assertAdminUserId(user);
    return this.moderation.approve(user.adminUserId, productId, dto.notes);
  }

  @Post("queue/:productId/reject")
  reject(
    @CurrentUser() user: JwtAccessPayload,
    @Param("productId") productId: string,
    @Body() dto: RejectProductDto,
  ) {
    this.assertAdminUserId(user);
    return this.moderation.reject(user.adminUserId, productId, dto.notes);
  }

  private assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
    if (!user.adminUserId) {
      // Unreachable in practice - AdminAuthGuard already requires this -
      // but keeps the service call below correctly typed rather than `!`.
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
  }
}
