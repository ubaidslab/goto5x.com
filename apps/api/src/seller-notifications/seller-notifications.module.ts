import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminNewsletterController } from "./admin-newsletter.controller";
import { DailySalesSummaryScheduler } from "./daily-sales-summary.scheduler";
import { DailySalesSummaryService } from "./daily-sales-summary.service";
import { NewsletterUnsubscribeController } from "./newsletter-unsubscribe.controller";
import { PlatformNewsletterService } from "./platform-newsletter.service";

/** Module 55 (SRS §5.62/FR-62.1-62.4) - Seller Notifications: daily sales summary sweep + the admin-composed platform newsletter. The other three transactional emails (new-order alert, low-stock alert, verification-failure alert) are wired directly into their originating services (CheckoutService, InventoryService, OrderVerificationService) rather than living here. */
@Module({
  imports: [SettingsModule],
  controllers: [AdminNewsletterController, NewsletterUnsubscribeController],
  providers: [DailySalesSummaryService, DailySalesSummaryScheduler, PlatformNewsletterService],
  exports: [DailySalesSummaryService, PlatformNewsletterService],
})
export class SellerNotificationsModule {}
