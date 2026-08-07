import { Module } from "@nestjs/common";
import { CustomerSegmentsModule } from "../customer-segments/customer-segments.module";
import { PlansModule } from "../plans/plans.module";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { EmailCampaignsController } from "./email-campaigns.controller";
import { EmailCampaignsService } from "./email-campaigns.service";
import { StorefrontCampaignsController } from "./storefront-campaigns.controller";

/**
 * Reaches SellerVerificationEmail (Module 26's connected-sender record,
 * FR-51.1) directly via the global PrismaAdminService rather than
 * importing OrderVerificationModule - no dependency on that module's own
 * service surface, just the shared, already-existing table.
 */
@Module({
  imports: [SettingsModule, PlansModule, CustomerSegmentsModule],
  controllers: [EmailCampaignsController, StorefrontCampaignsController],
  providers: [EmailCampaignsService, RateLimitService],
  exports: [EmailCampaignsService],
})
export class CampaignsModule {}
