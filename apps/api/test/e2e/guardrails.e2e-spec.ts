import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { DormantStoreService } from "../../src/guardrails/dormant-store.service";
import { UnitEconomicsService } from "../../src/guardrails/unit-economics.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedLedgerEntry, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const PASSWORD = "correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";
const S3_TEST_PORT = 4569;
const BUCKET = "uzeyn-media-test";

/** SRS §5.23/§14.21 - Business Guard-Rails & Platform Economics. */
describe("Business Guard-Rails (e2e) - SRS §5.23/§14.21", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let s3: TestS3Server;

  beforeAll(async () => {
    s3 = await startTestS3Server(S3_TEST_PORT, BUCKET);
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
    await s3.close();
  });

  afterEach(async () => {
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
  });

  async function signupAndCreateStore(email: string, slug: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store ${slug}`, slug });
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, storeId: store.body.id as string, sellerId: seller.id as string };
  }

  describe("Plan product-count limit (FR-23.1)", () => {
    it("rejects product creation at creation time once the plan's limit is reached - not a soft warning", async () => {
      // v0.33 - First Month (the signup default) carries its own
      // plan-scoped catalog.product_limit override (100, per plans.seed.ts)
      // which takes precedence over a global override (PRECEDENCE: plan
      // beats global) - so the test override must target First Month's own
      // plan scope, not global, to actually take effect.
      const firstMonthPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
      await app.get(SettingsService).setValue("catalog.product_limit", "plan", firstMonthPlan.id, 1, ADMIN_ID);
      const { token, storeId } = await signupAndCreateStore("product-limit@example.com", "product-limit-store");
      const category = await superuser.category.create({ data: { name: "Limit", slug: `limit-${Date.now()}` } });

      const first = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "First product", categoryId: category.id, status: "active" });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Second product", categoryId: category.id, status: "active" });
      expect(second.status).toBe(400);
    });
  });

  describe("Storage quota (FR-23.1)", () => {
    it("rejects an upload once the store's storage quota would be exceeded", async () => {
      await app.get(SettingsService).setValue("catalog.storage_quota_bytes", "global", null, 20, ADMIN_ID);
      const { token, storeId } = await signupAndCreateStore("storage-quota@example.com", "storage-quota-store");

      const first = await request(app.getHttpServer())
        .post(`/stores/${storeId}/media`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("0123456789"), { filename: "a.png", contentType: "image/png" });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/stores/${storeId}/media`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("0123456789"), { filename: "b.png", contentType: "image/png" });
      expect(second.status).toBe(201); // exactly at the 20-byte quota

      const third = await request(app.getHttpServer())
        .post(`/stores/${storeId}/media`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("x"), { filename: "c.png", contentType: "image/png" });
      expect(third.status).toBe(400);
    });
  });

  describe("No trial-of-paid-features (FR-23.3)", () => {
    it("a paid-plan-only feature stays inaccessible on First Month (no override there, v0.33) regardless of account age", async () => {
      const { token, storeId } = await signupAndCreateStore("no-trial@example.com", "no-trial-store");
      await superuser.store.update({ where: { id: storeId }, data: { createdAt: new Date("2020-01-01") } });

      const res = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ customCode: "<div>x</div>" });
      expect(res.status).toBe(403); // no "trial expired" path exists to accidentally leave open - just always false with no override
    });
  });

  describe("Dormant-store lifecycle (FR-23.2)", () => {
    it("progresses a test store through warning -> suspend -> archive at the configured thresholds, and not before them", async () => {
      await app.get(SettingsService).setValue("lifecycle.dormant_warning_days", "global", null, 10, ADMIN_ID);
      await app.get(SettingsService).setValue("lifecycle.dormant_suspend_days", "global", null, 5, ADMIN_ID);
      await app.get(SettingsService).setValue("lifecycle.dormant_archive_days", "global", null, 5, ADMIN_ID);
      const { storeId } = await signupAndCreateStore("dormant@example.com", "dormant-store");

      const dormantStores = app.get(DormantStoreService);

      // Not yet inactive long enough - no change.
      await superuser.store.update({ where: { id: storeId }, data: { lastActiveAt: new Date() } });
      let result = await dormantStores.runSweep(new Date());
      expect(result.warned).toBe(0);
      let store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.status).toBe("active");

      // Past the warning threshold - warned, still active.
      const elevenDaysAgo = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);
      await superuser.store.update({ where: { id: storeId }, data: { lastActiveAt: elevenDaysAgo } });
      result = await dormantStores.runSweep(new Date());
      expect(result.warned).toBe(1);
      store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.status).toBe("active");
      expect(store.dormantWarningSentAt).not.toBeNull();

      // Re-running immediately does not warn again, and does not suspend before suspendDays has passed.
      result = await dormantStores.runSweep(new Date());
      expect(result.warned).toBe(0);
      expect(result.suspended).toBe(0);

      // Past the suspend threshold (measured from the warning, not from last_active_at).
      await superuser.store.update({
        where: { id: storeId },
        data: { dormantWarningSentAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
      });
      result = await dormantStores.runSweep(new Date());
      expect(result.suspended).toBe(1);
      store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.status).toBe("suspended");

      // Past the archive threshold (measured from updated_at, bumped by the suspend step above).
      await superuser.store.update({ where: { id: storeId }, data: { updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } });
      result = await dormantStores.runSweep(new Date());
      expect(result.archived).toBe(1);
      store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.status).toBe("archived");
    });
  });

  describe("Unit-economics data (FR-23.4)", () => {
    it("totals commission across all (now-paid-only) stores, using the admin-entered infra cost for break-even", async () => {
      const { sellerId: sellerAId } = await signupAndCreateStore("unit-econ-a@example.com", "unit-econ-a-store");
      const { sellerId: sellerBId } = await signupAndCreateStore("unit-econ-b@example.com", "unit-econ-b-store");

      await seedLedgerEntry(superuser, { sellerId: sellerAId, type: "commission_accrued", amount: 10, currency: "PKR" });
      await seedLedgerEntry(superuser, { sellerId: sellerBId, type: "commission_accrued", amount: 5, currency: "PKR" });
      await app.get(SettingsService).setValue("finance.monthly_infra_cost", "global", null, 8, ADMIN_ID);

      const summary = await app.get(UnitEconomicsService).computeSummary();
      expect(summary.storeCount).toBe(2);
      expect(summary.totalCommission).toBe(15);
      expect(summary.monthlyInfraCost).toBe(8);
      expect(summary.breakEven).toBe(7); // 15 - 8
    });
  });
});
