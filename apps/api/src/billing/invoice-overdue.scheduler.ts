import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { INVOICE_OVERDUE_JOB_SCHEDULER_ID, INVOICE_OVERDUE_QUEUE_NAME } from "./invoice-overdue.queue";

/** FR-6.18 - grace-period-overdue sweep, same pattern as InvoiceGenerationScheduler. */
@Injectable()
export class InvoiceOverdueScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvoiceOverdueScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(INVOICE_OVERDUE_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const sweepHours = await this.settings.resolve<number>("billing.invoice_overdue_sweep_hours");
    await this.queue.upsertJobScheduler(INVOICE_OVERDUE_JOB_SCHEDULER_ID, { every: sweepHours * 60 * 60 * 1000 });
    this.logger.log(`Overdue-invoice sweep scheduled every ${sweepHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
