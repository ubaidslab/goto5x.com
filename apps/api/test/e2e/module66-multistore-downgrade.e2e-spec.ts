import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SRS §5.6k (v0.41), FR-6.43 (Module 66) - the multi-store downgrade rule.
 *
 * SRS §5.93/FR-93.1 (D74, 2026-10-09) flattened every individual plan to
 * stores.max_per_seller = 1 for the MVP window, superseding this module's
 * own GO1/RUN3/RISE5/FLY10 ladder, and B1's stores_one_active_per_seller
 * partial unique index makes "a seller with 2+ simultaneously active
 * stores" a hard database impossibility for any code path now - including
 * a test seeding that precondition directly. The three tests this used to
 * run for determineChoiceRequirement()/applyDowngrade() (which all needed
 * to start from 2+ pre-existing active stores, reachable only via an
 * upgrade that no longer grants extra slots) moved to
 * multi-store-downgrade.service.spec.ts, a unit suite against a fake
 * Prisma client the index can't constrain. What's left here -
 * reclaimOnUpgrade()'s 30-day window - still has a real, reachable e2e
 * precondition: orders_paused stores, seeded directly (never transitioning
 * through "active"), don't touch the new index at all.
 */
describe("Multi-store downgrade rule (e2e) - SRS §5.6k/§14.66 (Module 66, FR-6.43)", () => {
  let app: INestApplication;
  let superuser: PrismaClient;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
  });

  afterEach(async () => {
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
  });

  async function signup(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, sellerId: seller.id as string };
  }

  async function createAndLoginAdmin(email: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  async function grantPlan(adminToken: string, sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
    const res = await request(app.getHttpServer())
      .post(`/admin/sellers/${sellerId}/plan`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ planId: plan.id });
    expect(res.status).toBe(201);
    return plan;
  }

  // B1/FR-93.1: every individual tier's max is 1 now, so the one way
  // reclaimOnUpgrade() still has anything to do is a seller who currently
  // has ZERO active stores (the grandfather case: all were paused by the
  // migration's data-fix or a later downgrade) getting a plan applied -
  // seeded directly via superuser, never through the live create() API,
  // since these rows go straight to orders_paused without ever passing
  // through "active" and therefore never touch stores_one_active_per_seller.
  async function createPausedStore(sellerId: string, slug: string, createdAt: Date, overLimitPausedAt: Date) {
    const store = await superuser.store.create({
      data: { sellerId, name: "Store", slug, status: "orders_paused", createdAt, overLimitPausedAt },
    });
    return store.id;
  }

  it("FR-6.43: a plan grant reclaims the oldest-paused store first, up to the one free slot, and never deletes anything", async () => {
    const adminToken = await createAndLoginAdmin("downgrade-admin4@example.com");
    const seller = await signup("downgrade-reclaim@example.com");
    const newerPaused = await createPausedStore(seller.sellerId, "downgrade-reclaim-newer", new Date(Date.now() - 2 * DAY_MS), new Date());
    const olderPaused = await createPausedStore(seller.sellerId, "downgrade-reclaim-older", new Date(Date.now() - 5 * DAY_MS), new Date());

    // Any individual-tier grant resolves max=1 under FR-93.1; this seller
    // has 0 active stores, so exactly 1 free slot opens.
    await grantPlan(adminToken, seller.sellerId, 1); // RUN

    const reclaimed = await superuser.store.findUniqueOrThrow({ where: { id: olderPaused } });
    expect(reclaimed.status).toBe("active"); // oldest-paused-first, matching applyDowngrade()'s own convention
    expect(reclaimed.overLimitPausedAt).toBeNull();

    const stillPaused = await superuser.store.findUniqueOrThrow({ where: { id: newerPaused } });
    expect(stillPaused.status).toBe("orders_paused"); // the one free slot already went to the older row
    expect(stillPaused.overLimitPausedAt).not.toBeNull(); // never deleted, no data lost
  });

  it("FR-6.43: after the 30-day reclaim window elapses, a plan grant does NOT auto-restore the store - it stays paused, never deleted", async () => {
    const adminToken = await createAndLoginAdmin("downgrade-admin5@example.com");
    const seller = await signup("downgrade-expired-window@example.com");
    const pausedStoreId = await createPausedStore(seller.sellerId, "downgrade-expired-2", new Date(Date.now() - 40 * DAY_MS), new Date(Date.now() - 31 * DAY_MS));

    await grantPlan(adminToken, seller.sellerId, 1); // well after the window

    const row = await superuser.store.findUniqueOrThrow({ where: { id: pausedStoreId } });
    expect(row.status).toBe("orders_paused"); // never auto-reclaimed
    expect(row.overLimitPausedAt).not.toBeNull(); // never deleted, no data lost
  });
});
