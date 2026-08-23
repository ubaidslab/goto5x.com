import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { SUPPORT_TICKET_SLA_JOB_SCHEDULER_ID, SUPPORT_TICKET_SLA_QUEUE_NAME } from "./support-ticket-sla.queue";

/** SRS §5.6k/FR-8.18 (Module 90) - same pattern as every other scheduler here. */
@Injectable()
export class SupportTicketSlaScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupportTicketSlaScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(SUPPORT_TICKET_SLA_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const checkHours = await this.settings.resolve<number>("support.sla_sweep_check_hours");
    await this.queue.upsertJobScheduler(SUPPORT_TICKET_SLA_JOB_SCHEDULER_ID, { every: checkHours * 60 * 60 * 1000 });
    this.logger.log(`Support-ticket SLA near-breach sweep checked every ${checkHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
