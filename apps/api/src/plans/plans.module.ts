import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SettingsModule } from "../settings-registry/settings.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { AdminPlansController } from "./admin-plans.controller";
import { AdminSubscriptionsController } from "./admin-subscriptions.controller";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";
import { PromoCodesService } from "./promo-codes.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { SupplierSubscriptionsController } from "./supplier-subscriptions.controller";
import { MultiStoreDowngradeService } from "./multi-store-downgrade.service";
import { PlanCycleScheduler } from "./plan-cycle.scheduler";

@Module({
  imports: [AdminModule, TrustSafetyModule, SettingsModule],
  controllers: [
    PlansController,
    AdminPlansController,
    SubscriptionsController,
    AdminSubscriptionsController,
    SupplierSubscriptionsController,
  ],
  providers: [PlansService, SubscriptionsService, PromoCodesService, MultiStoreDowngradeService, PlanCycleScheduler],
  exports: [PlansService, SubscriptionsService, PromoCodesService, MultiStoreDowngradeService],
})
export class PlansModule {}
