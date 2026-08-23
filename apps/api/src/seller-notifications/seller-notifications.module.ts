import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminNewsletterController } from "./admin-newsletter.controller";
import { DailySalesSummaryScheduler } from "./daily-sales-summary.scheduler";
import { DailySalesSummaryService } from "./daily-sales-summary.service";
import { MilestonesController } from "./milestones.controller";
import { MilestonesService } from "./milestones.service";
import { MonthlySellerReportService } from "./monthly-seller-report.service";
import { MonthlySellerReportScheduler } from "./monthly-seller-report.scheduler";
import { NewsletterUnsubscribeController } from "./newsletter-unsubscribe.controller";
import { PlatformNewsletterService } from "./platform-newsletter.service";

/** Module 55 (SRS §5.62/FR-62.1-62.4) - Seller Notifications: daily sales summary sweep + the admin-composed platform newsletter. The other three transactional emails (new-order alert, low-stock alert, verification-failure alert) are wired directly into their originating services (CheckoutService, InventoryService, OrderVerificationService) rather than living here. Also hosts Module 47's milestone-celebration slice (FR-47.2/47.3) - the same "seller-facing lifecycle surface, detection wired into the originating service" shape. */
@Module({
  imports: [SettingsModule],
  controllers: [AdminNewsletterController, NewsletterUnsubscribeController, MilestonesController],
  providers: [DailySalesSummaryService, DailySalesSummaryScheduler, PlatformNewsletterService, MilestonesService, MonthlySellerReportService, MonthlySellerReportScheduler],
  exports: [DailySalesSummaryService, PlatformNewsletterService, MilestonesService, MonthlySellerReportService],
})
export class SellerNotificationsModule {}
