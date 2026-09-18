import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { SettingsService } from "../settings-registry/settings.service";
import { DATABASE_BACKUP_JOB_SCHEDULER_ID, DATABASE_BACKUP_QUEUE_NAME } from "./database-backup.queue";

/** Backups reality check (Risk 5/13) - same pattern as WalletReconciliationScheduler. */
@Injectable()
export class DatabaseBackupScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseBackupScheduler.name);
  private queue?: Queue;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    this.queue = new Queue(DATABASE_BACKUP_QUEUE_NAME, {
      connection: { url: this.config.getOrThrow<string>("REDIS_URL") },
    });
    const intervalHours = await this.settings.resolve<number>("backups.database_backup_interval_hours");
    await this.queue.upsertJobScheduler(DATABASE_BACKUP_JOB_SCHEDULER_ID, { every: intervalHours * 60 * 60 * 1000 });
    this.logger.log(`Database backup sweep scheduled every ${intervalHours} hour(s).`);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
