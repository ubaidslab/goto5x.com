import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { INVOICE_GENERATION_JOB_SCHEDULER_ID, INVOICE_GENERATION_QUEUE_NAME } from "./invoice-generation.queue";

/** FR-6.17 - same pattern as CartAbandonmentScheduler/DomainVerificationScheduler. */
@Injectable()
export class InvoiceGenerationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvoiceGenerationScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(INVOICE_GENERATION_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("billing.invoice_generation_check_hours");
    await this.queue.upsertJobScheduler(INVOICE_GENERATION_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`Invoice generation checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
