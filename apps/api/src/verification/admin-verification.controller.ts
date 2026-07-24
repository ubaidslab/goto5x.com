import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { DecisionNotesDto, RevokeNotesDto } from "./dto/decision-notes.dto";
import { VerificationApplicationService } from "./verification-application.service";

/**
 * SRS §5.35 admin surface. Money-adjacent (fee refund on reject) - guarded
 * by AdminAuthGuard only (super_admin/support), matching the existing
 * "money-moving admin actions are never @AllowReviewer()" precedent
 * (AdminTrustSafetyController/AdminSellerLifecycleController).
 */
@Controller("admin/verification")
@UseGuards(AdminAuthGuard)
export class AdminVerificationController {
  constructor(private readonly applications: VerificationApplicationService) {}

  @Get("applications")
  listQueue() {
    return this.applications.listQueue();
  }

  @Post("applications/:applicationId/approve")
  approve(@CurrentUser() user: JwtAccessPayload, @Param("applicationId") applicationId: string, @Body() dto: DecisionNotesDto) {
    return this.applications.approve(user.adminUserId!, applicationId, dto.notes);
  }

  @Post("applications/:applicationId/reject")
  reject(@CurrentUser() user: JwtAccessPayload, @Param("applicationId") applicationId: string, @Body() dto: DecisionNotesDto) {
    return this.applications.reject(user.adminUserId!, applicationId, dto.notes);
  }

  @Get("re-review")
  listPendingReReview() {
    return this.applications.listPendingReReview();
  }

  @Post("stores/:storeId/re-review/clear")
  clearReReview(@CurrentUser() user: JwtAccessPayload, @Param("storeId") storeId: string, @Body() dto: DecisionNotesDto) {
    return this.applications.clearReReview(user.adminUserId!, storeId, dto.notes);
  }

  @Post("stores/:storeId/revoke")
  revoke(@CurrentUser() user: JwtAccessPayload, @Param("storeId") storeId: string, @Body() dto: RevokeNotesDto) {
    return this.applications.revoke(user.adminUserId!, storeId, dto.notes);
  }
}
