import { gunzipSync } from "zlib";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { Readable } from "stream";
import { DatabaseBackupService } from "../../src/backups/database-backup.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const BACKUP_S3_TEST_PORT = 4570;
const BACKUP_BUCKET = "uzeyn-backups-test";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * Backups reality check (Risk 5/13) - proves DatabaseBackupService.runBackup()
 * end-to-end against real infra on both sides: a real `pg_dump` subprocess
 * against the real test database (same DATABASE_ADMIN_URL every other e2e
 * spec's app instance uses), and a real S3-compatible server (s3rver, this
 * project's established "real infra over mocks" pattern - see
 * s3-test-server.ts) standing in for the off-box BACKUP_S3_* target -
 * deliberately a SECOND, distinct s3rver instance/bucket from the one
 * MINIO_ENDPOINT points at, since the whole point being proven here is that
 * this target is genuinely separate from the primary on-box store.
 *
 * Two describe blocks, each with its own app instance, because
 * BackupStorageService reads BACKUP_S3_* at Nest DI construction time
 * (ConfigModule.forRoot's `validate` snapshots process.env once per
 * `Test.createTestingModule(...).compile()` call) - the "configured" and
 * "not configured" paths genuinely need two different processes' worth of
 * environment, not just two test cases sharing one app.
 */
describe("Database backup sweep, configured (e2e) - Risk 5/13", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let backupS3: TestS3Server;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    backupS3 = await startTestS3Server(BACKUP_S3_TEST_PORT, BACKUP_BUCKET);
    process.env.BACKUP_S3_ENDPOINT = `http://localhost:${BACKUP_S3_TEST_PORT}`;
    process.env.BACKUP_S3_BUCKET = BACKUP_BUCKET;
    process.env.BACKUP_S3_ACCESS_KEY_ID = "S3RVER";
    process.env.BACKUP_S3_SECRET_ACCESS_KEY = "S3RVER";

    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
    await backupS3.close();
    process.env = { ...originalEnv };
  });

  it("dumps the real database, gzips it, uploads it to the off-box target, and records a successful run", async () => {
    const result = await app.get(DatabaseBackupService).runBackup();

    expect(result.status).toBe("success");
    expect(result.objectKey).toBeDefined();
    expect(result.sizeBytes).toBeGreaterThan(0);

    const run = await superuser.databaseBackupRun.findFirst({ orderBy: { finishedAt: "desc" } });
    expect(run?.status).toBe("success");
    expect(run?.objectKey).toBe(result.objectKey);
    expect(run?.sizeBytes).toBe(result.sizeBytes);
    expect(run?.errorMessage).toBeNull();

    // Prove the uploaded object is retrievable AND is a real, restorable
    // pg_dump - not just "some bytes landed in the bucket".
    const client = new S3Client({
      endpoint: process.env.BACKUP_S3_ENDPOINT,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" },
    });
    const fetched = await client.send(new GetObjectCommand({ Bucket: BACKUP_BUCKET, Key: result.objectKey! }));
    const gzipped = await streamToBuffer(fetched.Body as Readable);
    const sql = gunzipSync(gzipped).toString("utf8");
    expect(sql).toContain("PostgreSQL database dump");
    // `users` is a real, always-present table in this schema - proves the
    // dump covers actual application tables, not an empty/malformed dump.
    expect(sql).toContain("CREATE TABLE");
    expect(sql.toLowerCase()).toContain("public.users");
  });
});

describe("Database backup sweep, not configured (e2e) - Risk 5/13", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    delete process.env.BACKUP_S3_ENDPOINT;
    delete process.env.BACKUP_S3_BUCKET;
    delete process.env.BACKUP_S3_ACCESS_KEY_ID;
    delete process.env.BACKUP_S3_SECRET_ACCESS_KEY;

    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
    process.env = { ...originalEnv };
  });

  it("never touches pg_dump's output silently - it honestly records skipped_not_configured, not a fabricated success", async () => {
    const result = await app.get(DatabaseBackupService).runBackup();

    expect(result.status).toBe("skipped_not_configured");
    expect(result.objectKey).toBeUndefined();
    expect(result.sizeBytes).toBeUndefined();

    const run = await superuser.databaseBackupRun.findFirst({ orderBy: { finishedAt: "desc" } });
    expect(run?.status).toBe("skipped_not_configured");
    expect(run?.objectKey).toBeNull();
  });
});
