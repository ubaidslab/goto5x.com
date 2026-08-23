import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminAnalyticsController, AdminUnitEconomicsController } from "./admin-unit-economics.controller";
import { DormantStoreScheduler } from "./dormant-store.scheduler";
import { DormantStoreService } from "./dormant-store.service";
import { MrrAnalyticsService } from "./mrr-analytics.service";
import { SellerHealthFunnelService } from "./seller-health-funnel.service";
import { UnitEconomicsService } from "./unit-economics.service";

@Module({
  imports: [SettingsModule],
  controllers: [AdminUnitEconomicsController, AdminAnalyticsController],
  providers: [DormantStoreService, DormantStoreScheduler, UnitEconomicsService, MrrAnalyticsService, SellerHealthFunnelService],
  exports: [DormantStoreService, UnitEconomicsService, MrrAnalyticsService, SellerHealthFunnelService],
})
export class GuardrailsModule {}
