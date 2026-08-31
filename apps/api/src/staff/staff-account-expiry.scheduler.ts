import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { STAFF_ACCOUNT_EXPIRY_JOB_SCHEDULER_ID, STAFF_ACCOUNT_EXPIRY_QUEUE_NAME } from "./staff-account-expiry.queue";

/**
 * SRS §5.52/FR-52.10 - "auto-expiring (revoking, not deleting the
 * account), no manual cleanup needed." Same pattern as every other sweep
 * scheduler here (e.g. PlanCycleScheduler); the actual flip happens in
 * StaffAccountsService.runExpirySweep(), run by the Worker in
 * worker.main.ts.
 */
@Injectable()
export class StaffAccountExpiryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaffAccountExpiryScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(STAFF_ACCOUNT_EXPIRY_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("staff.expiry_sweep_check_hours");
    await this.queue.upsertJobScheduler(STAFF_ACCOUNT_EXPIRY_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`Staff-account expiry sweep checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
