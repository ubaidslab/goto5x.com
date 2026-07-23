import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AllowReviewer } from "../common/decorators/allow-reviewer.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { ApplyProgramDto } from "./dto/apply-program.dto";
import { DecideApplicationDto } from "./dto/decide-application.dto";
import { ProgramApplicationService } from "./program-application.service";
import { ProgramRewardService } from "./program-reward.service";

/** SRS §5.33 FR-33.2/33.5/33.6/33.7 - a seller applies to a program; no self-serve join. */
@Controller("sellers/me/growth-programs")
@UseGuards(JwtAuthGuard)
export class SellerProgramApplicationController {
  constructor(
    private readonly applications: ProgramApplicationService,
    private readonly rewards: ProgramRewardService,
  ) {}

  @Post("applications")
  apply(@CurrentSellerId() sellerId: string, @Body() dto: ApplyProgramDto) {
    return this.applications.apply(sellerId, dto.programType);
  }

  @Get("applications")
  listOwn(@CurrentSellerId() sellerId: string) {
    return this.applications.listOwn(sellerId);
  }

  /** FR-33.5 - an Ambassador's own live certificate tier + lifetime referred-paid count. */
  @Get("ambassador/certificate-tier")
  certificateTier(@CurrentSellerId() sellerId: string) {
    return this.rewards.currentCertificateTier(sellerId);
  }
}

/** FR-33.11 - the admin application/participant-lifecycle queue. */
@Controller("admin/growth-programs/applications")
@UseGuards(AdminAuthGuard)
@AllowReviewer()
export class AdminProgramApplicationController {
  constructor(private readonly applications: ProgramApplicationService) {}

  @Get("queue")
  listQueue() {
    return this.applications.listQueue();
  }

  @Post(":participantId/approve")
  approve(@CurrentUser() user: JwtAccessPayload, @Param("participantId") participantId: string, @Body() dto: DecideApplicationDto) {
    this.assertAdminUserId(user);
    return this.applications.approve(user.adminUserId, participantId, dto.notes);
  }

  @Post(":participantId/reject")
  reject(@CurrentUser() user: JwtAccessPayload, @Param("participantId") participantId: string, @Body() dto: DecideApplicationDto) {
    this.assertAdminUserId(user);
    return this.applications.reject(user.adminUserId, participantId, dto.notes);
  }

  @Post(":participantId/suspend")
  suspend(@CurrentUser() user: JwtAccessPayload, @Param("participantId") participantId: string, @Body() dto: DecideApplicationDto) {
    this.assertAdminUserId(user);
    return this.applications.suspend(user.adminUserId, participantId, dto.notes);
  }

  @Post(":participantId/terminate")
  terminate(@CurrentUser() user: JwtAccessPayload, @Param("participantId") participantId: string, @Body() dto: DecideApplicationDto) {
    this.assertAdminUserId(user);
    return this.applications.terminate(user.adminUserId, participantId, dto.notes);
  }

  private assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
    if (!user.adminUserId) {
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
  }
}
