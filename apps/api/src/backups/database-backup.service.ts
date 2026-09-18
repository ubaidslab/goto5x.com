import { spawn } from "child_process";
import { createGzip } from "zlib";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { EventsService } from "../events/events.service";
import { BackupStorageService } from "./backup-storage.service";

export interface DatabaseBackupResult {
  status: "success" | "failed" | "skipped_not_configured";
  sizeBytes?: number;
  objectKey?: string;
  errorMessage?: string;
}

/**
 * Backups reality check (Risk 5/13) - the real automated `pg_dump` sweep
 * docs/SRS.md's Risk Register claimed already existed but didn't (see this
 * module's docstring in AdminSystemStatusService, and CHANGELOG.md's
 * "backups are a disclosed stub" line). Runs `pg_dump` against
 * DATABASE_ADMIN_URL (app_admin already has BYPASSRLS + a blanket grant on
 * every table via bootstrap-db.sql - sufficient for a complete logical
 * dump, no new DB role/secret needed), gzips the output in-process, and
 * uploads it to BackupStorageService's genuinely off-box S3-compatible
 * target. Plain-text SQL (`pg_dump`'s default format), gzipped - matches
 * docs/launch-runbook.md's already-documented `gunzip -c ... | psql`
 * restore procedure exactly, so a founder following that doc against a
 * real dump this service produced works unmodified.
 *
 * Never auto-corrects/retries and never throws out of runBackup() - same
 * "record the outcome, don't hide it, don't crash the sweep" discipline as
 * WalletReconciliationService. An unconfigured BackupStorageService is
 * recorded as `skipped_not_configured`, not silently skipped and not a
 * failure - that's the honest state the founder still needs to see on the
 * system status page and decide whether to provision an off-box target.
 *
 * Explicitly NOT covered by this pass (founder-level infra decision, not
 * an engineering judgment call): point-in-time recovery/WAL archiving, and
 * an off-box copy of the MinIO data directory (Risk 13) - both need a real
 * second storage account provisioned, same as this one's BACKUP_S3_* does.
 */
@Injectable()
export class DatabaseBackupService {
  private readonly logger = new Logger(DatabaseBackupService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly storage: BackupStorageService,
    private readonly events: EventsService,
  ) {}

  async runBackup(): Promise<DatabaseBackupResult> {
    const startedAt = new Date();

    if (!this.storage.isConfigured()) {
      const result: DatabaseBackupResult = { status: "skipped_not_configured" };
      await this.recordRun(startedAt, result);
      this.logger.warn("Database backup sweep skipped - BACKUP_S3_* is not configured (no off-box target).");
      return result;
    }

    try {
      const dump = await this.dumpAndGzip();
      const objectKey = `postgres/uzeyn-${startedAt.toISOString().replace(/[:.]/g, "-")}.sql.gz`;
      await this.storage.putObject(objectKey, dump);
      const result: DatabaseBackupResult = { status: "success", sizeBytes: dump.byteLength, objectKey };
      await this.recordRun(startedAt, result);
      this.logger.log(`Database backup uploaded: ${objectKey} (${dump.byteLength} bytes).`);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const result: DatabaseBackupResult = { status: "failed", errorMessage };
      const run = await this.recordRun(startedAt, result);
      this.logger.error(`Database backup sweep failed: ${errorMessage}`);
      await this.events.emit({
        eventType: "backups.database_backup_failed",
        actorType: "system",
        entityType: "database_backup_run",
        entityId: run.id,
        metadata: { errorMessage },
      });
      return result;
    }
  }

  /**
   * Spawns `pg_dump` against DATABASE_ADMIN_URL and pipes its stdout through
   * gzip, collected in memory. `pg_dump` exiting non-zero closes its stdout
   * like a clean exit would, so gzip's own `end` event alone can't tell a
   * truncated dump from a complete one - both the exit code AND gzip's
   * `end` are awaited before settling, whichever arrives last.
   */
  private dumpAndGzip(): Promise<Buffer> {
    // DATABASE_ADMIN_URL carries Prisma's own `?schema=public` query param
    // (every real config in this repo sets it - see .env.example) - libpq
    // (and therefore pg_dump) rejects "schema" as an unrecognized URI
    // query parameter outright ("invalid URI query parameter"), caught by
    // actually running pg_dump against the real .env.example-shaped
    // connection string, not assumed. pg_dump doesn't need it anyway - it
    // dumps every schema in the database by default, Prisma's `schema`
    // param only affects Prisma Client's own default search_path.
    const databaseAdminUrl = this.config.getOrThrow<string>("DATABASE_ADMIN_URL").split("?")[0];
    return new Promise((resolve, reject) => {
      const pgDump = spawn("pg_dump", [databaseAdminUrl], { stdio: ["ignore", "pipe", "pipe"] });
      const gzip = createGzip();
      const chunks: Buffer[] = [];
      let stderr = "";
      let exitCode: number | null = null;
      let gzipEnded = false;
      let settled = false;

      const settle = () => {
        if (settled || exitCode === null || !gzipEnded) return;
        settled = true;
        if (exitCode !== 0) {
          reject(new Error(`pg_dump exited with code ${exitCode}: ${stderr.trim()}`));
        } else {
          resolve(Buffer.concat(chunks));
        }
      };
      const failFast = (err: Error) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      pgDump.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      pgDump.on("error", (err) => failFast(new Error(`pg_dump failed to start: ${err.message}`)));

      gzip.on("data", (chunk: Buffer) => chunks.push(chunk));
      gzip.on("error", (err) => failFast(new Error(`gzip failed: ${err.message}`)));

      pgDump.stdout.pipe(gzip);

      pgDump.on("close", (code) => {
        exitCode = code ?? 1;
        settle();
      });
      gzip.on("end", () => {
        gzipEnded = true;
        settle();
      });
    });
  }

  /** AdminSystemStatusService's data source - the most recent run's outcome, or null if the sweep has never run yet. */
  getLatestRun() {
    return this.prismaAdmin.databaseBackupRun.findFirst({ orderBy: { finishedAt: "desc" } });
  }

  private recordRun(startedAt: Date, result: DatabaseBackupResult) {
    return this.prismaAdmin.databaseBackupRun.create({
      data: {
        status: result.status,
        startedAt,
        finishedAt: new Date(),
        sizeBytes: result.sizeBytes,
        objectKey: result.objectKey,
        errorMessage: result.errorMessage,
      },
    });
  }
}
