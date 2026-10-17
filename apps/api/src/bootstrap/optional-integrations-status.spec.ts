import { ConfigService } from "@nestjs/config";
import { listOffOptionalIntegrations } from "./optional-integrations-status";

describe("listOffOptionalIntegrations (D126)", () => {
  function configFor(env: Record<string, string>): ConfigService {
    return new ConfigService(env);
  }

  it("lists every optional integration when none of them are configured", () => {
    expect(listOffOptionalIntegrations(configFor({}))).toEqual([
      "Sentry error tracking",
      "off-box database backups",
      "Google Drive import",
      "Printify dropshipping",
    ]);
  });

  it("lists nothing when every optional integration is fully configured", () => {
    const fullyConfigured = configFor({
      SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
      BACKUP_S3_ENDPOINT: "https://s3.example.com",
      BACKUP_S3_BUCKET: "uzeyn-backups",
      BACKUP_S3_ACCESS_KEY_ID: "access-key",
      BACKUP_S3_SECRET_ACCESS_KEY: "secret-key",
      GOOGLE_DRIVE_CLIENT_ID: "client-id",
      GOOGLE_DRIVE_CLIENT_SECRET: "client-secret",
      GOOGLE_DRIVE_REDIRECT_URI: "https://app.example.com/media/drive/callback",
      PRINTIFY_API_KEY: "printify-key",
    });
    expect(listOffOptionalIntegrations(fullyConfigured)).toEqual([]);
  });

  it("lists only the integrations actually off in a mixed configuration", () => {
    // Sentry and Printify configured; backups only PARTIALLY configured
    // (missing BACKUP_S3_SECRET_ACCESS_KEY - BackupStorageService's own
    // 4-var AND would also treat this as unconfigured, so this must too);
    // Google Drive entirely unset.
    const mixed = configFor({
      SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
      BACKUP_S3_ENDPOINT: "https://s3.example.com",
      BACKUP_S3_BUCKET: "uzeyn-backups",
      BACKUP_S3_ACCESS_KEY_ID: "access-key",
      PRINTIFY_API_KEY: "printify-key",
    });
    expect(listOffOptionalIntegrations(mixed)).toEqual(["off-box database backups", "Google Drive import"]);
  });
});
