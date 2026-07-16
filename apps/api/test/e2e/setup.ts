import { ValidationPipe, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { AppModule } from "../../src/app.module";
import { seedModule1Settings, seedModule3Settings } from "../../src/settings-registry/settings.seed";

/**
 * Builds a real NestJS app wired to the real local Postgres/Redis started for
 * this test run (see README "Running tests") - no mocking of the database or
 * cache, since the whole point of Module 1's test list is proving the RLS/
 * settings-registry/audit-log mechanisms against a real Postgres instance.
 */
export async function buildTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

/**
 * Test cleanup needs to TRUNCATE `admin_audit_logs`/`user_security_events`,
 * which even app_admin cannot do - those two tables intentionally revoke
 * UPDATE/DELETE from every application role for immutability (SRS FR-8.9),
 * and TRUNCATE isn't granted to either role either. Only the Postgres
 * superuser can reset them, so test setup/teardown uses that connection
 * string directly - a test-only concern, not a production code path, and
 * never the connection string the running application itself uses.
 */
export function superuserPrismaForTests(): PrismaClient {
  const url = process.env.TEST_SUPERUSER_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_SUPERUSER_DATABASE_URL must be set to run e2e tests (see README).");
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      admin_audit_logs, settings_values, settings_definitions,
      domains,
      media_assets, product_variants, products, categories,
      google_drive_connections,
      stores, admin_users, sellers, user_security_events, users, plans
    RESTART IDENTITY CASCADE
  `);
}

export async function seedSettings(prisma: PrismaClient): Promise<void> {
  await seedModule1Settings(prisma);
  await seedModule3Settings(prisma);
}

/**
 * The Settings Registry cache and the auth rate limiter both live in Redis,
 * which is a single shared server across the whole test run (not reset per
 * Postgres TRUNCATE). Without this, a rate-limit override or a cached
 * setting value from one test leaks into the next test/file and produces
 * confusing, order-dependent failures - caught by running the full e2e
 * suite repeatedly and seeing results change based on run order/timing,
 * which is exactly the smell of shared mutable state leaking across tests.
 */
export async function resetRedis(): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL!);
  await redis.flushall();
  await redis.quit();
}
