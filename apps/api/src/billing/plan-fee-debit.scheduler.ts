import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { PLAN_FEE_DEBIT_JOB_SCHEDULER_ID, PLAN_FEE_DEBIT_QUEUE_NAME } from "./plan-fee-debit.queue";

/** FR-6.24/FR-7.2 (revised) - same pattern as InvoiceGenerationScheduler before it, the job it replaces. */
@Injectable()
export class PlanFeeDebitScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlanFeeDebitScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(PLAN_FEE_DEBIT_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("billing.plan_fee_debit_check_hours");
    await this.queue.upsertJobScheduler(PLAN_FEE_DEBIT_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`Plan-fee/team-seat/device-slot wallet debit checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
