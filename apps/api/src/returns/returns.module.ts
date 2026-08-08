import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { BillingModule } from "../billing/billing.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { CustomersModule } from "../customers/customers.module";
import { EmailService } from "../notifications/email.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { StorefrontModule } from "../storefront/storefront.module";
import { AdminReturnsController } from "./admin-returns.controller";
import { ReturnSubmissionController } from "./return-submission.controller";
import { ReturnsController } from "./returns.controller";
import { ReturnsService } from "./returns.service";

/** Module 53 (SRS §5.60/FR-60.1-60.6) - Returns & Refunds Workflow. */
@Module({
  imports: [SettingsModule, BillingModule, CustomersModule, StorefrontModule, AdminModule],
  controllers: [ReturnSubmissionController, ReturnsController, AdminReturnsController],
  providers: [ReturnsService, EmailService, RateLimitService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
