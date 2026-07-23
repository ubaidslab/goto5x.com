import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { JwtAccessPayload } from "../common/types";
import { DecidePaymentReviewDto } from "./dto/decide-payment-review.dto";
import { PublishAgreementVersionDto } from "./dto/publish-agreement-version.dto";
import { PaymentReviewQueueService } from "./payment-review-queue.service";
import { SellerAgreementService } from "./seller-agreement.service";
import { TrustSafetyMonitorsService } from "./trust-safety-monitors.service";

/**
 * SRS §5.29/§5.30 - the T&S/risk-view admin surface: read-only monitor
 * views (FR-29.3/FR-6.19), the payment-instrument name-consistency review
 * queue (FR-30.2), and Seller Agreement version publishing (FR-29.1). Not
 * `@AllowReviewer()` for the same reason as AdminSellerLifecycleController.
 */
@Controller("admin/trust-safety")
@UseGuards(AdminAuthGuard)
export class AdminTrustSafetyController {
  constructor(
    private readonly monitors: TrustSafetyMonitorsService,
    private readonly paymentReview: PaymentReviewQueueService,
    private readonly agreements: SellerAgreementService,
  ) {}

  @Get("monitors/cancellation-rate")
  cancellationRate() {
    return this.monitors.cancellationRateFlags();
  }

  @Get("monitors/pending-forever-rate")
  pendingForeverRate() {
    return this.monitors.pendingForeverRateFlags();
  }

  @Get("monitors/signup-velocity")
  signupVelocity() {
    return this.monitors.signupVelocityFlags();
  }

  @Get("monitors/bypass-attempts")
  bypassAttempts() {
    return this.monitors.bypassAttemptFlags();
  }

  /** Module 22 (SRS §5.33 FR-33.10) - self-referral/fake-cluster signal for Growth & Partner Programs. */
  @Get("monitors/self-referral")
  selfReferral() {
    return this.monitors.selfReferralFlags();
  }

  @Get("payment-review/queue")
  listPaymentReviewQueue() {
    return this.paymentReview.listQueue();
  }

  @Post("payment-review/:storeId/approve")
  approvePaymentReview(
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Body() dto: DecidePaymentReviewDto,
  ) {
    this.assertAdminUserId(user);
    return this.paymentReview.approve(user.adminUserId, storeId, dto.notes);
  }

  @Post("payment-review/:storeId/reject")
  rejectPaymentReview(
    @CurrentUser() user: JwtAccessPayload,
    @Param("storeId") storeId: string,
    @Body() dto: DecidePaymentReviewDto,
  ) {
    this.assertAdminUserId(user);
    return this.paymentReview.reject(user.adminUserId, storeId, dto.notes);
  }

  @Get("agreement-versions/current")
  getCurrentAgreementVersion() {
    return this.agreements.getCurrentVersion();
  }

  @Post("agreement-versions")
  publishAgreementVersion(@Body() dto: PublishAgreementVersionDto) {
    return this.agreements.publishNewVersion(dto.version);
  }

  private assertAdminUserId(user: JwtAccessPayload): asserts user is JwtAccessPayload & { adminUserId: string } {
    if (!user.adminUserId) {
      throw new ForbiddenException("This endpoint requires an authenticated admin session.");
    }
  }
}
