import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { PLAN_FEE_RENEWAL_EXPORT_JOB_NAME, PLAN_FEE_RENEWAL_EXPORT_QUEUE_NAME } from "./plan-fee-renewal-export.queue";

/**
 * Module 73 (v0.38) - bridges an admin-verified plan-fee RENEWAL payment to
 * Module 24's data-export trigger (FR-36.1(a)) without BillingModule
 * importing DataExportModule directly, which would create a real module
 * cycle (DataExportModule -> MediaModule -> AuthModule ->
 * GrowthProgramsModule -> BillingModule already exists - see
 * PlanFeeDebitService's original comment). Before Module 73, this trigger
 * fired from the wallet-auto-debit sweep at the worker orchestration layer
 * (a place outside the module graph); now that renewals are admin-verified
 * over HTTP instead of swept, this queue is that same orchestration bridge
 * for the HTTP path - AdminWalletController pushes a job here, and
 * worker.main.ts (already outside the module graph) consumes it and calls
 * DataExportService directly.
 */
@Injectable()
export class PlanFeeRenewalExportTrigger implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.queue = new Queue(PLAN_FEE_RENEWAL_EXPORT_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  async trigger(sellerId: string): Promise<void> {
    await this.queue!.add(PLAN_FEE_RENEWAL_EXPORT_JOB_NAME, { sellerId });
  }
}
