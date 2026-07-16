import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { DOMAIN_VERIFICATION_JOB_SCHEDULER_ID, DOMAIN_VERIFICATION_QUEUE_NAME } from "./domain-verification.queue";

/**
 * Schedules the repeatable recheck job (SRS FR-11.2's automated,
 * without-a-button-click half) - the actual processing happens in a
 * separate `Worker`, registered in worker.main.ts, matching this project's
 * existing app/worker process split (docs/docker-compose.yml). Uses its own
 * dedicated Redis connection rather than sharing the app-wide RedisService,
 * so BullMQ owns that connection's lifecycle independently of caching/rate-
 * limiting's use of Redis elsewhere.
 */
@Injectable()
export class DomainVerificationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DomainVerificationScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(DOMAIN_VERIFICATION_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const pollMinutes = await this.settings.resolve<number>("domains.verification_poll_minutes");
    // upsertJobScheduler is idempotent by design - safe to call on every app
    // boot without creating duplicate repeatable jobs.
    await this.queue.upsertJobScheduler(DOMAIN_VERIFICATION_JOB_SCHEDULER_ID, { every: pollMinutes * 60_000 });
    this.logger.log(`Domain verification recheck scheduled every ${pollMinutes} minute(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
