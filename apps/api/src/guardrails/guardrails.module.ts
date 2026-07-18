import { Module } from "@nestjs/common";
import { EmailService } from "../notifications/email.service";
import { SettingsModule } from "../settings-registry/settings.module";
import { AdminUnitEconomicsController } from "./admin-unit-economics.controller";
import { DormantStoreScheduler } from "./dormant-store.scheduler";
import { DormantStoreService } from "./dormant-store.service";
import { FreeStoreLimitService } from "./free-store-limit.service";
import { UnitEconomicsService } from "./unit-economics.service";

@Module({
  imports: [SettingsModule],
  controllers: [AdminUnitEconomicsController],
  providers: [FreeStoreLimitService, DormantStoreService, DormantStoreScheduler, UnitEconomicsService, EmailService],
  exports: [FreeStoreLimitService, DormantStoreService, UnitEconomicsService],
})
export class GuardrailsModule {}
