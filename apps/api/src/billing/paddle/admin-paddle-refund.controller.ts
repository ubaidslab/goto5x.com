import { Controller, Get, Param, Post, UseGuards, UseInterceptors } from "@nestjs/common";
import { AdminAuthGuard } from "../../common/guards/admin-auth.guard";
import { StepUpMfaGuard } from "../../common/guards/step-up-mfa.guard";
import { IdempotencyInterceptor } from "../../common/idempotency/idempotency.interceptor";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAccessPayload } from "../../common/types";
import { PrismaAdminService } from "../../prisma/prisma-admin.service";
import { PaddleSubscriptionLifecycleService } from "./paddle-subscription-lifecycle.service";

/**
 * D134 - the refund-hopping guard's "otherwise: admin review" branch.
 * Same step-up-MFA + idempotency pairing as AdminWalletController's own
 * money-moving verify()/reject() (D116 items 1+2) - a refund approval
 * is exactly that class of action.
 */
@Controller("admin/paddle-refund-requests")
@UseGuards(AdminAuthGuard)
export class AdminPaddleRefundController {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly lifecycle: PaddleSubscriptionLifecycleService,
  ) {}

  @Get("pending")
  listPending() {
    return this.prismaAdmin.paddleRefundRequest.findMany({ where: { status: "pending" }, orderBy: { requestedAt: "asc" } });
  }

  @Post(":refundRequestId/approve")
  @UseGuards(StepUpMfaGuard)
  @UseInterceptors(IdempotencyInterceptor)
  approve(@Param("refundRequestId") refundRequestId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.lifecycle.adminApproveRefund(refundRequestId, user.adminUserId!);
  }

  @Post(":refundRequestId/reject")
  @UseGuards(StepUpMfaGuard)
  @UseInterceptors(IdempotencyInterceptor)
  reject(@Param("refundRequestId") refundRequestId: string, @CurrentUser() user: JwtAccessPayload) {
    return this.lifecycle.adminRejectRefund(refundRequestId, user.adminUserId!);
  }
}
