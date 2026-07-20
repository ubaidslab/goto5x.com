import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import {
  WALLET_LOW_BALANCE_SWEEP_JOB_SCHEDULER_ID,
  WALLET_LOW_BALANCE_SWEEP_QUEUE_NAME,
} from "./wallet-low-balance-sweep.queue";

/** FR-6.25 - same pattern as InvoiceGenerationScheduler/InvoiceOverdueScheduler before it. */
@Injectable()
export class WalletLowBalanceSweepScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletLowBalanceSweepScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(WALLET_LOW_BALANCE_SWEEP_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const sweepHours = await this.settings.resolve<number>("billing.wallet_low_balance_sweep_hours");
    await this.queue.upsertJobScheduler(WALLET_LOW_BALANCE_SWEEP_JOB_SCHEDULER_ID, { every: sweepHours * 60 * 60 * 1000 });
    this.logger.log(`Wallet low-balance sweep checked every ${sweepHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
