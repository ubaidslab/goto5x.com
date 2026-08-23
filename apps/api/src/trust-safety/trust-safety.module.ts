import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminSellerLifecycleController } from "./admin-seller-lifecycle.controller";
import { AdminTrustSafetyController } from "./admin-trust-safety.controller";
import { PaymentInstrumentIdentityService } from "./payment-instrument-identity.service";
import { PaymentReviewQueueService } from "./payment-review-queue.service";
import { RiskScoreService } from "./risk-score.service";
import { SellerAgreementGuard } from "./seller-agreement.guard";
import { SellerAgreementService } from "./seller-agreement.service";
import { SellerIdentityService } from "./seller-identity.service";
import { SellerLifecycleService } from "./seller-lifecycle.service";
import { SubscriptionAbuseService } from "./subscription-abuse.service";
import { TrustSafetyMonitorsService } from "./trust-safety-monitors.service";

/**
 * Module 12: Trust & Safety System (SRS §5.29/§5.30). Exports everything
 * other modules (auth, orders/checkout, store-settings) need to wire in -
 * see docs/build-plan.md for the full module report.
 */
@Module({
  imports: [SettingsModule, AdminModule],
  controllers: [AdminSellerLifecycleController, AdminTrustSafetyController],
  providers: [
    SellerAgreementService,
    SellerAgreementGuard,
    SellerIdentityService,
    RiskScoreService,
    PaymentInstrumentIdentityService,
    PaymentReviewQueueService,
    SellerLifecycleService,
    TrustSafetyMonitorsService,
    SubscriptionAbuseService,
  ],
  exports: [
    SellerAgreementService,
    SellerAgreementGuard,
    SellerIdentityService,
    RiskScoreService,
    PaymentInstrumentIdentityService,
    PaymentReviewQueueService,
    SellerLifecycleService,
    TrustSafetyMonitorsService,
    SubscriptionAbuseService,
  ],
})
export class TrustSafetyModule {}
