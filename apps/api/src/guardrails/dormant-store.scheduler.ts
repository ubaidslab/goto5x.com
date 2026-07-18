import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { DORMANT_STORE_JOB_SCHEDULER_ID, DORMANT_STORE_QUEUE_NAME } from "./dormant-store.queue";

/** FR-23.2 - same pattern as CartAbandonmentScheduler/InvoiceGenerationScheduler. */
@Injectable()
export class DormantStoreScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DormantStoreScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(DORMANT_STORE_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("lifecycle.dormant_sweep_check_hours");
    await this.queue.upsertJobScheduler(DORMANT_STORE_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`Dormant-store sweep checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
