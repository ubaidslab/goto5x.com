import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { AdminPlansController } from "./admin-plans.controller";
import { AdminSubscriptionsController } from "./admin-subscriptions.controller";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";
import { PromoCodesService } from "./promo-codes.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { SupplierSubscriptionsController } from "./supplier-subscriptions.controller";

@Module({
  imports: [AdminModule, TrustSafetyModule],
  controllers: [
    PlansController,
    AdminPlansController,
    SubscriptionsController,
    AdminSubscriptionsController,
    SupplierSubscriptionsController,
  ],
  providers: [PlansService, SubscriptionsService, PromoCodesService],
  exports: [PlansService, SubscriptionsService, PromoCodesService],
})
export class PlansModule {}
