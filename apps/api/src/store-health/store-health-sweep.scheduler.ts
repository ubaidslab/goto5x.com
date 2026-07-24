import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { STORE_HEALTH_SWEEP_JOB_SCHEDULER_ID, STORE_HEALTH_SWEEP_QUEUE_NAME } from "./store-health-sweep.queue";

/** FR-34.2 - same repeatable-job pattern as WalletLowBalanceSweepScheduler/DomainVerificationScheduler. */
@Injectable()
export class StoreHealthSweepScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StoreHealthSweepScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(STORE_HEALTH_SWEEP_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const hours = await this.settings.resolve<number>("storehealth.recompute_interval_hours");
    await this.queue.upsertJobScheduler(STORE_HEALTH_SWEEP_JOB_SCHEDULER_ID, { every: hours * 60 * 60 * 1000 });
    this.logger.log(`Store Health Score recompute scheduled every ${hours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
