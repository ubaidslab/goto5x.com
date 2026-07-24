import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { GuardrailsModule } from "../guardrails/guardrails.module";
import { StoreHealthModule } from "../store-health/store-health.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { AdminOverviewController } from "./admin-overview.controller";
import { AdminOverviewService } from "./admin-overview.service";
import { AdminSearchController } from "./admin-search.controller";
import { AdminSearchService } from "./admin-search.service";
import { AdminSellerOverviewController } from "./admin-seller-overview.controller";
import { AdminSellerOverviewService } from "./admin-seller-overview.service";

/**
 * Module 25 (Admin Completion) - the admin HOME overview, global search, and
 * seller-360 aggregation endpoints. Deliberately a new leaf module (nothing
 * imports it) rather than adding these endpoints to five different existing
 * controllers - it only reads across modules that already export the
 * services it needs, so it can depend on all of them without any of them
 * needing to know it exists.
 */
@Module({
  imports: [TrustSafetyModule, GuardrailsModule, BillingModule, StoreHealthModule, AuthModule],
  controllers: [AdminOverviewController, AdminSearchController, AdminSellerOverviewController],
  providers: [AdminOverviewService, AdminSearchService, AdminSellerOverviewService],
})
export class AdminCompletionModule {}
