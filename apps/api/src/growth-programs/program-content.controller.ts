import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AllowReviewer } from "../common/decorators/allow-reviewer.decorator";
import { CurrentSellerId } from "../common/decorators/current-seller.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { SubmitContentDto } from "./dto/submit-content.dto";
import { VerifyContentDto } from "./dto/verify-content.dto";
import { ProgramRewardService } from "./program-reward.service";

/** SRS §5.33 FR-33.7 - a Creator submits a content link + reported views; nothing pays out until admin-verified. */
@Controller("sellers/me/growth-programs/content")
@UseGuards(JwtAuthGuard)
export class SellerProgramContentController {
  constructor(private readonly rewards: ProgramRewardService) {}

  @Post()
  submit(@CurrentSellerId() sellerId: string, @Body() dto: SubmitContentDto) {
    return this.rewards.submitContent(sellerId, dto.platform, dto.contentUrl, dto.reportedViews);
  }

  @Get()
  listOwn(@CurrentSellerId() sellerId: string) {
    return this.rewards.listOwnSubmissions(sellerId);
  }
}

/** FR-33.11 - the content-link verification queue (Creators only). */
@Controller("admin/growth-programs/content-submissions")
@UseGuards(AdminAuthGuard)
@AllowReviewer()
export class AdminProgramContentController {
  constructor(private readonly rewards: ProgramRewardService) {}

  @Get("queue")
  listQueue() {
    return this.rewards.listVerificationQueue();
  }

  @Post(":submissionId/verify")
  verify(@CurrentUser() user: JwtAccessPayload, @Param("submissionId") submissionId: string, @Body() dto: VerifyContentDto) {
    this.assertAdminUserId(user);
    return this.rewards.verify(user.adminUserId, submissionId, dto.notes);
  }

  @Post(":submissionId/reject")
  reject(@CurrentUser() user: JwtAccessPayload, @Param("submissionId") submissionId: string, @Body() dto: VerifyContentDto) {
    this.assertAdminUserId(user);
    return this.rewards.reject(user.adminUserId, submissionId, dto.notes);
  }

  private assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
    if (!user.adminUserId) {
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
  }
}
