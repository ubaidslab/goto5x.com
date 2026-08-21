import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { RENEWAL_REMINDERS_JOB_SCHEDULER_ID, RENEWAL_REMINDERS_QUEUE_NAME } from "./renewal-reminders.queue";

/** SRS §5.6k/FR-6.42 (Module 65) - same pattern as RetentionScheduler. */
@Injectable()
export class RenewalRemindersScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RenewalRemindersScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(RENEWAL_REMINDERS_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("billing.renewal_reminder_sweep_check_hours");
    await this.queue.upsertJobScheduler(RENEWAL_REMINDERS_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`Renewal-reminder / win-back email sweep checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
