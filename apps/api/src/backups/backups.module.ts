import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings-registry/settings.module";
import { BackupStorageService } from "./backup-storage.service";
import { DatabaseBackupService } from "./database-backup.service";
import { DatabaseBackupScheduler } from "./database-backup.scheduler";

/**
 * Backups reality check (Risk 5/13) - a new leaf module, same shape as
 * BillingModule's reconciliation pair: PrismaAdminService/EventsService
 * come from the @Global() PrismaModule/EventsModule, so only SettingsModule
 * (for the scheduler's interval setting) needs an explicit import here.
 */
@Module({
  imports: [SettingsModule],
  providers: [BackupStorageService, DatabaseBackupService, DatabaseBackupScheduler],
  exports: [BackupStorageService, DatabaseBackupService],
})
export class BackupsModule {}
