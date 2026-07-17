import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { SUPPLIER_SYNC_JOB_SCHEDULER_ID, SUPPLIER_SYNC_QUEUE_NAME } from "./supplier-sync.queue";

/**
 * Schedules the repeatable price/stock sync job (FR-4.3) - same pattern as
 * `DomainVerificationScheduler` (Module 3): the actual processing happens
 * in a separate `Worker`, registered in worker.main.ts.
 */
@Injectable()
export class SupplierSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupplierSyncScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(SUPPLIER_SYNC_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const pollMinutes = await this.settings.resolve<number>("suppliers.sync_poll_minutes");
    await this.queue.upsertJobScheduler(SUPPLIER_SYNC_JOB_SCHEDULER_ID, { every: pollMinutes * 60_000 });
    this.logger.log(`Supplier price/stock sync scheduled every ${pollMinutes} minute(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
