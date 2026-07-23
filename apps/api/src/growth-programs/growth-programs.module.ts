import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { BillingModule } from "../billing/billing.module";
import { PlansModule } from "../plans/plans.module";
import { SettingsModule } from "../settings-registry/settings.module";
import {
  AdminProgramApplicationController,
  SellerProgramApplicationController,
} from "./program-application.controller";
import { ProgramApplicationService } from "./program-application.service";
import { AdminProgramContentController, SellerProgramContentController } from "./program-content.controller";
import { AdminProgramReportController } from "./program-report.controller";
import { ProgramReportService } from "./program-report.service";
import { ProgramRewardService } from "./program-reward.service";
import { ReferralAttributionService } from "./referral-attribution.service";
import { AdminProgramWithdrawalController, SellerProgramWithdrawalController } from "./program-withdrawal.controller";
import { ProgramWithdrawalService } from "./program-withdrawal.service";

/**
 * Module 22 Phase A (SRS §5.33) - the shared referral engine (Ambassador/
 * Student Referral/Creators). `BillingModule` is imported one-directionally
 * (for `WalletService`, used by the withdrawal flow) - `BillingModule`
 * itself never imports this module back (see `ProgramCommissionService`'s
 * own comment in `apps/api/src/billing/` for why: it reads this module's
 * tables directly via `PrismaAdminService`, no DI needed), so there is no
 * circular module dependency.
 */
@Module({
  imports: [SettingsModule, AdminModule, PlansModule, BillingModule],
  controllers: [
    SellerProgramApplicationController,
    AdminProgramApplicationController,
    SellerProgramContentController,
    AdminProgramContentController,
    SellerProgramWithdrawalController,
    AdminProgramWithdrawalController,
    AdminProgramReportController,
  ],
  providers: [
    ProgramApplicationService,
    ReferralAttributionService,
    ProgramRewardService,
    ProgramWithdrawalService,
    ProgramReportService,
  ],
  exports: [ReferralAttributionService],
})
export class GrowthProgramsModule {}
