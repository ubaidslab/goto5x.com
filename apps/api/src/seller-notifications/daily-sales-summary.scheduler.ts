import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { DAILY_SALES_SUMMARY_JOB_SCHEDULER_ID, DAILY_SALES_SUMMARY_QUEUE_NAME } from "./daily-sales-summary.queue";

/** FR-62.1 - same repeatable-job pattern as StoreHealthSweepScheduler/WalletReconciliationScheduler. */
@Injectable()
export class DailySalesSummaryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailySalesSummaryScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(DAILY_SALES_SUMMARY_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const hours = await this.settings.resolve<number>("notifications.daily_sales_summary_interval_hours");
    await this.queue.upsertJobScheduler(DAILY_SALES_SUMMARY_JOB_SCHEDULER_ID, { every: hours * 60 * 60 * 1000 });
    this.logger.log(`Daily sales summary sweep scheduled every ${hours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
