import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { PLATFORM_GATEWAY_RECONCILIATION_JOB_SCHEDULER_ID, PLATFORM_GATEWAY_RECONCILIATION_QUEUE_NAME } from "./platform-gateway-reconciliation.queue";

/** Financial-safety hardening - same pattern as WalletReconciliationScheduler. */
@Injectable()
export class PlatformGatewayReconciliationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformGatewayReconciliationScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(PLATFORM_GATEWAY_RECONCILIATION_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const intervalHours = await this.settings.resolve<number>("billing.platform_gateway_reconciliation_interval_hours");
    await this.queue.upsertJobScheduler(PLATFORM_GATEWAY_RECONCILIATION_JOB_SCHEDULER_ID, { every: intervalHours * 60 * 60 * 1000 });
    this.logger.log(`Platform gateway reconciliation checked every ${intervalHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
