import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { WALLET_RECONCILIATION_JOB_SCHEDULER_ID, WALLET_RECONCILIATION_QUEUE_NAME } from "./wallet-reconciliation.queue";

/** Module 47 (new FR-6.29) - same pattern as WalletLowBalanceSweepScheduler/PlanFeeDebitScheduler before it. */
@Injectable()
export class WalletReconciliationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletReconciliationScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(WALLET_RECONCILIATION_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const intervalHours = await this.settings.resolve<number>("billing.wallet_reconciliation_interval_hours");
    await this.queue.upsertJobScheduler(WALLET_RECONCILIATION_JOB_SCHEDULER_ID, { every: intervalHours * 60 * 60 * 1000 });
    this.logger.log(`Wallet balance reconciliation checked every ${intervalHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
