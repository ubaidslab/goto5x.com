import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { MONTHLY_SELLER_REPORT_JOB_SCHEDULER_ID, MONTHLY_SELLER_REPORT_QUEUE_NAME } from "./monthly-seller-report.queue";

/** SRS §5.6k/FR-6.47 (Module 70a) - same repeatable-job pattern as DailySalesSummaryScheduler. Checks far more often than it actually sends (the service itself only acts on the 1st of the month). */
@Injectable()
export class MonthlySellerReportScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonthlySellerReportScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(MONTHLY_SELLER_REPORT_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const hours = await this.settings.resolve<number>("notifications.monthly_seller_report_check_hours");
    await this.queue.upsertJobScheduler(MONTHLY_SELLER_REPORT_JOB_SCHEDULER_ID, { every: hours * 60 * 60 * 1000 });
    this.logger.log(`Monthly seller report sweep checked every ${hours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
