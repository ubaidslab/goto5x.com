import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { PLAN_CYCLE_JOB_SCHEDULER_ID, PLAN_CYCLE_QUEUE_NAME } from "./plan-cycle.queue";

/**
 * FR-7.5 - SubscriptionsService.applyDueCycleChanges() existed but was
 * never actually wired to a recurring job (only a direct test call
 * exercised it) - a real gap, surfaced while building Module 66 on top of
 * this exact mechanism (a downgrade's store-limit pause only ever applies
 * from inside this same sweep). Same pattern as every other scheduler
 * here.
 */
@Injectable()
export class PlanCycleScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlanCycleScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(PLAN_CYCLE_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("billing.plan_cycle_sweep_check_hours");
    await this.queue.upsertJobScheduler(PLAN_CYCLE_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`Pending plan-cycle change sweep checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
