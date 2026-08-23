import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { GATEWAY_HEALTH_JOB_SCHEDULER_ID, GATEWAY_HEALTH_QUEUE_NAME } from "./gateway-health.queue";

/** SRS §5.6k/FR-6.44 (Module 67) - same pattern as every other scheduler here. */
@Injectable()
export class GatewayHealthScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GatewayHealthScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(GATEWAY_HEALTH_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("billing.gateway_health_sweep_check_hours");
    await this.queue.upsertJobScheduler(GATEWAY_HEALTH_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`Payment gateway health-check sweep checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
