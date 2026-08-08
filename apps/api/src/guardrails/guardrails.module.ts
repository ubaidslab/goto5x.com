import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminAnalyticsController, AdminUnitEconomicsController } from "./admin-unit-economics.controller";
import { DormantStoreScheduler } from "./dormant-store.scheduler";
import { DormantStoreService } from "./dormant-store.service";
import { UnitEconomicsService } from "./unit-economics.service";

@Module({
  imports: [SettingsModule],
  controllers: [AdminUnitEconomicsController, AdminAnalyticsController],
  providers: [DormantStoreService, DormantStoreScheduler, UnitEconomicsService],
  exports: [DormantStoreService, UnitEconomicsService],
})
export class GuardrailsModule {}
