import { ConfigService } from "@nestjs/config";

/**
 * D126 (founder decision, Stage 0 beta) - a single place that answers
 * "which optional, gracefully-degrading integrations are off right now",
 * for main.ts's startup log line. Mirrors each integration's own
 * isConfigured() check exactly - never re-derives the logic, just restates
 * which vars each one reads:
 *  - Sentry (common/error-tracking/sentry.ts's initSentry()) - one var.
 *  - Off-box database backups (backups/backup-storage.service.ts's
 *    BackupStorageService) - all 4 BACKUP_S3_* vars must be present, same
 *    AND as that service's own constructor check.
 *  - Google Drive import (media/google-drive/google-drive-client.service.ts)
 *    - all 3 OAuth vars must be present.
 *  - Printify dropshipping (suppliers/printify/printify-http-client.service.ts)
 *    - one var.
 * Pure and side-effect-free: reads via config.get() (never getOrThrow()),
 * same discipline as every optional integration it checks - a missing var
 * must never throw here.
 */
export function listOffOptionalIntegrations(config: ConfigService): string[] {
  const off: string[] = [];

  if (!config.get<string>("SENTRY_DSN")) {
    off.push("Sentry error tracking");
  }

  const backupsConfigured = Boolean(
    config.get<string>("BACKUP_S3_ENDPOINT") &&
      config.get<string>("BACKUP_S3_BUCKET") &&
      config.get<string>("BACKUP_S3_ACCESS_KEY_ID") &&
      config.get<string>("BACKUP_S3_SECRET_ACCESS_KEY"),
  );
  if (!backupsConfigured) {
    off.push("off-box database backups");
  }

  const driveConfigured = Boolean(
    config.get<string>("GOOGLE_DRIVE_CLIENT_ID") &&
      config.get<string>("GOOGLE_DRIVE_CLIENT_SECRET") &&
      config.get<string>("GOOGLE_DRIVE_REDIRECT_URI"),
  );
  if (!driveConfigured) {
    off.push("Google Drive import");
  }

  if (!config.get<string>("PRINTIFY_API_KEY")) {
    off.push("Printify dropshipping");
  }

  return off;
}
