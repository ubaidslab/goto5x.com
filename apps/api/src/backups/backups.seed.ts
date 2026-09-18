import { PrismaClient } from "@prisma/client";

/** Backups reality check (Risk 5/13) - same "settings-driven interval hours" pattern as billing/wallet.seed.ts's reconciliation-interval key. */
export async function seedBackupsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "backups.database_backup_interval_hours" },
    create: {
      key: "backups.database_backup_interval_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description:
        "How often the automated database backup sweep runs (default 24 = daily) - dumps the database via pg_dump, gzips it, and uploads it to the configured off-box target (BACKUP_S3_*). Recorded as skipped_not_configured, not silently skipped, whenever that target isn't set.",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });
}
