import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { BillingModule } from "../billing/billing.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { StoreHealthModule } from "../store-health/store-health.module";
import { AdminVerificationController } from "./admin-verification.controller";
import { VerificationApplicationService } from "./verification-application.service";
import { VerificationController } from "./verification.controller";
import { VerificationEligibilityService } from "./verification-eligibility.service";
import { VerificationReReviewService } from "./verification-re-review.service";
import { VerificationReReviewSweepScheduler } from "./verification-re-review-sweep.scheduler";

/**
 * Module 23 (SRS §5.35) - imports StoreHealthModule (one-directional, for
 * the eligibility gate's health-score read and the re-review sweep's
 * drift check) and BillingModule (for the wallet fee debit/refund) - never
 * the reverse, so no cycle exists.
 */
@Module({
  imports: [SettingsModule, AdminModule, BillingModule, StoreHealthModule],
  controllers: [VerificationController, AdminVerificationController],
  providers: [VerificationEligibilityService, VerificationApplicationService, VerificationReReviewService, VerificationReReviewSweepScheduler],
  exports: [VerificationReReviewService],
})
export class VerificationModule {}
