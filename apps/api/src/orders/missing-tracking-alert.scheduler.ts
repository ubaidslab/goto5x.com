import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { MISSING_TRACKING_ALERT_JOB_SCHEDULER_ID, MISSING_TRACKING_ALERT_QUEUE_NAME } from "./missing-tracking-alert.queue";

/** Phase 5 (founder-requested "missing tracking" alert) - same pattern as every other sweep scheduler here (e.g. GatewayHealthScheduler). */
@Injectable()
export class MissingTrackingAlertScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MissingTrackingAlertScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(MISSING_TRACKING_ALERT_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("orders.missing_tracking_sweep_check_hours");
    await this.queue.upsertJobScheduler(MISSING_TRACKING_ALERT_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`Missing-tracking alert sweep checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
