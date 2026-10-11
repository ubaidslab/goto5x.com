import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { DEFAULT_SWEEP_JOB_OPTIONS } from "../common/queue-defaults.util";
import {
  MANUAL_TRANSFER_AUTO_CANCEL_JOB_SCHEDULER_ID,
  MANUAL_TRANSFER_AUTO_CANCEL_QUEUE_NAME,
} from "./manual-transfer-auto-cancel.queue";

/** B3b (founder decision, 2026-10-11) - same pattern as every other sweep scheduler here (e.g. MissingTrackingAlertScheduler). Checks hourly, same cadence as the cart-abandonment sweep - the per-store timeout itself (default 48h) is a separate, store-scoped setting the sweep resolves per order. */
@Injectable()
export class ManualTransferAutoCancelScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ManualTransferAutoCancelScheduler.name);
  private queue?: Queue;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.queue = new Queue(MANUAL_TRANSFER_AUTO_CANCEL_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    await this.queue.upsertJobScheduler(
      MANUAL_TRANSFER_AUTO_CANCEL_JOB_SCHEDULER_ID,
      { every: 60 * 60 * 1000 },
      { opts: DEFAULT_SWEEP_JOB_OPTIONS },
    );
    this.logger.log("Manual-transfer auto-cancel sweep checked every hour.");
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
