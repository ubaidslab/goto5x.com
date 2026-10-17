import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { buildTestApp } from "./setup";

/**
 * D126 (founder decision, Stage 0 beta) - proves the app boots and serves
 * real traffic with every optional, gracefully-degrading integration
 * (Google Drive, Printify, Sentry, off-box backups) completely unconfigured
 * - exactly the beta launch condition for the first 5-10 sellers, none of
 * whom touch Drive import or Printify dropshipping yet. Deliberately
 * minimal - no resetDatabase()/resetRedis() from the shared setup, since
 * nothing here asserts on seeded data, only that construction (env
 * validation + every provider's constructor) succeeds and the booted app
 * can actually serve a request.
 */
describe("App boot with every optional integration unconfigured (e2e, D126)", () => {
  const OPTIONAL_ENV_KEYS = [
    "GOOGLE_DRIVE_CLIENT_ID",
    "GOOGLE_DRIVE_CLIENT_SECRET",
    "GOOGLE_DRIVE_REDIRECT_URI",
    "PRINTIFY_API_KEY",
    "SENTRY_DSN",
    "BACKUP_S3_ENDPOINT",
    "BACKUP_S3_BUCKET",
    "BACKUP_S3_ACCESS_KEY_ID",
    "BACKUP_S3_SECRET_ACCESS_KEY",
  ] as const;

  it("boots normally and serves a real request with none of them configured", async () => {
    const saved = new Map<string, string | undefined>();
    for (const key of OPTIONAL_ENV_KEYS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }

    let app: INestApplication | undefined;
    try {
      const appPromise = buildTestApp();
      await expect(appPromise).resolves.toBeDefined();
      app = await appPromise;

      // Smoke assertion: /health is unauthenticated and (see
      // health.e2e-spec.ts) already proven to report real db/redis
      // connectivity - a 200 here proves the full HTTP stack, the Nest DI
      // graph (every optional integration's constructor included), and the
      // real Postgres/Redis connections all came up cleanly with none of
      // these vars set. Chosen over a bare 404-from-a-nonsense-path
      // fallback because this endpoint already exists in this app and
      // gives a strictly stronger proof than routing-is-alive alone.
      const health = await request(app.getHttpServer()).get("/health");
      expect(health.status).toBe(200);
      expect(health.body).toEqual({ status: "ok", db: true, redis: true });
    } finally {
      if (app) await app.close();
      // Critical: e2e files run sequentially in one process (--maxWorkers=1)
      // - every other e2e spec file in this shard expects .env.test's real
      // values for these vars (e.g. google-drive.e2e-spec.ts's fake-client
      // flow), so they must be restored even if an assertion above failed.
      for (const key of OPTIONAL_ENV_KEYS) {
        const value = saved.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
