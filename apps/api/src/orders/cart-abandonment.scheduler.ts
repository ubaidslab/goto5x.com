import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { CART_ABANDONMENT_JOB_SCHEDULER_ID, CART_ABANDONMENT_QUEUE_NAME } from "./cart-abandonment.queue";

/**
 * FR-15.2 - schedules the repeatable abandoned-cart sweep. Same pattern as
 * `DomainVerificationScheduler`/`SupplierSyncScheduler`: the actual
 * processing happens in a separate `Worker`, registered in worker.main.ts.
 */
@Injectable()
export class CartAbandonmentScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CartAbandonmentScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(CART_ABANDONMENT_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const sweepMinutes = await this.settings.resolve<number>("cart.abandonment_sweep_minutes");
    await this.queue.upsertJobScheduler(CART_ABANDONMENT_JOB_SCHEDULER_ID, { every: sweepMinutes * 60_000 });
    this.logger.log(`Abandoned-cart sweep scheduled every ${sweepMinutes} minute(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
