import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { StoreHealthController } from "./store-health.controller";
import { StoreHealthScoreService } from "./store-health-score.service";
import { StoreHealthSweepScheduler } from "./store-health-sweep.scheduler";

/**
 * Module 23 (SRS §5.34). Exports StoreHealthScoreService so
 * VerificationModule (also Module 23, tightly coupled per the founder's own
 * slotting) can read the latest score for its eligibility gate - a
 * one-directional import (VerificationModule -> StoreHealthModule), never
 * the reverse, since this module never needs anything verification-specific.
 */
@Module({
  imports: [SettingsModule],
  controllers: [StoreHealthController],
  providers: [StoreHealthScoreService, StoreHealthSweepScheduler],
  exports: [StoreHealthScoreService],
})
export class StoreHealthModule {}
