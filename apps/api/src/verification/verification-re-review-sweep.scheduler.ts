import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import {
  VERIFICATION_RE_REVIEW_SWEEP_JOB_SCHEDULER_ID,
  VERIFICATION_RE_REVIEW_SWEEP_QUEUE_NAME,
} from "./verification-re-review-sweep.queue";

/** FR-35.5/35.6 - same repeatable-job pattern as every other sweep in this SRS. */
@Injectable()
export class VerificationReReviewSweepScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VerificationReReviewSweepScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(VERIFICATION_RE_REVIEW_SWEEP_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const hours = await this.settings.resolve<number>("verification.rereview_sweep_interval_hours");
    await this.queue.upsertJobScheduler(VERIFICATION_RE_REVIEW_SWEEP_JOB_SCHEDULER_ID, { every: hours * 60 * 60 * 1000 });
    this.logger.log(`Verified Store re-review/expiry sweep scheduled every ${hours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
