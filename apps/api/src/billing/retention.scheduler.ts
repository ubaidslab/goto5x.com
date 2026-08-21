import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { RETENTION_JOB_SCHEDULER_ID, RETENTION_QUEUE_NAME } from "./retention.queue";

/** SRS §5.6k/FR-6.41 (Module 64) - same pattern as DormantStoreScheduler. */
@Injectable()
export class RetentionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(RETENTION_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("billing.retention_sweep_check_hours");
    await this.queue.upsertJobScheduler(RETENTION_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`14-day data-retention warning/deletion sweep checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
