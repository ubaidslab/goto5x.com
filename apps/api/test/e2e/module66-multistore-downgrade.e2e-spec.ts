import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SubscriptionsService } from "../../src/plans/subscriptions.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SRS §5.6k (v0.41), FR-6.43 (Module 66) - the multi-store downgrade rule:
 * GO(1)/RUN(3)/RISE(5)/FLY(10) store limits (stores.seed.ts), a
 * confirmation step when a downgrade puts the seller over the new limit,
 * oldest-store-stays-active as the unchosen default, a 30-day reclaim
 * window on upgrade, and never a forced deletion.
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

  async function createStore(token: string, slug: string) {
    const res = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${token}`).send({ name: "Store", slug });
    expect(res.status).toBe(201);
    return res.body.id as string;
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

  it("FR-6.43: requesting a downgrade over the new limit returns a store-choice requirement instead of applying anything", async () => {
    const adminToken = await createAndLoginAdmin("downgrade-admin1@example.com");
    const seller = await signup("downgrade-choice@example.com");
    const store1 = await createStore(seller.token, "downgrade-choice-1");
    await grantPlan(adminToken, seller.sellerId, 1); // RUN (max 3)
    await createStore(seller.token, "downgrade-choice-2");
    await createStore(seller.token, "downgrade-choice-3");

    const goPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    const change = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: goPlan.id });

    expect(change.status).toBe(201);
    expect(change.body.requiresStoreChoice).toBe(true);
    expect(change.body.maxStores).toBe(1);
    expect(change.body.activeStores).toHaveLength(3);
    expect(change.body.activeStores[0].id).toBe(store1); // oldest first

    // Nothing was staged - a re-fetch shows no pendingPlanId yet.
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    expect(subscription.pendingPlanId).toBeNull();
  });

  it("FR-6.43: a chosen store stays active, unchosen stores get overLimitPausedAt at the moment the downgrade actually applies (cycle end), never immediately", async () => {
    const adminToken = await createAndLoginAdmin("downgrade-admin2@example.com");
    const seller = await signup("downgrade-chosen@example.com");
    await createStore(seller.token, "downgrade-chosen-1");
    await grantPlan(adminToken, seller.sellerId, 1); // RUN (max 3)
    const keepStoreId = await createStore(seller.token, "downgrade-chosen-2");
    const otherStoreId = await createStore(seller.token, "downgrade-chosen-3");

    const goPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    const change = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: goPlan.id, keepStoreIds: [keepStoreId] });
    expect(change.status).toBe(201);
    expect(change.body.pendingPlanId).toBe(goPlan.id);

    // Deferred - nothing paused yet, still within the current cycle.
    const beforeCycleEnd = await superuser.store.findUniqueOrThrow({ where: { id: otherStoreId } });
    expect(beforeCycleEnd.status).toBe("active");

    // Back-date the cycle end and run the real scheduled sweep.
    await superuser.subscription.update({ where: { sellerId: seller.sellerId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    const subscriptions = app.get(SubscriptionsService);
    const result = await subscriptions.applyDueCycleChanges(new Date());
    expect(result.applied).toBe(1);

    const kept = await superuser.store.findUniqueOrThrow({ where: { id: keepStoreId } });
    expect(kept.status).toBe("active");
    expect(kept.overLimitPausedAt).toBeNull();

    const paused = await superuser.store.findUniqueOrThrow({ where: { id: otherStoreId } });
    expect(paused.status).toBe("orders_paused");
    expect(paused.overLimitPausedAt).not.toBeNull();

    const afterSubscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    expect(afterSubscription.planId).toBe(goPlan.id);
    expect(afterSubscription.pendingKeepStoreIds).toEqual([]);
  });

  it("FR-6.43: with no seller choice, the oldest store stays active by default and every newer store is paused", async () => {
    const adminToken = await createAndLoginAdmin("downgrade-admin3@example.com");
    const seller = await signup("downgrade-default@example.com");
    const oldest = await createStore(seller.token, "downgrade-default-1");
    await grantPlan(adminToken, seller.sellerId, 1); // RUN (max 3)
    const newer1 = await createStore(seller.token, "downgrade-default-2");
    const newer2 = await createStore(seller.token, "downgrade-default-3");

    // Admin-granted downgrade - bypasses the seller confirmation step entirely (FR-7.8), applies immediately.
    await grantPlan(adminToken, seller.sellerId, 0); // GO (max 1)

    const oldestRow = await superuser.store.findUniqueOrThrow({ where: { id: oldest } });
    expect(oldestRow.status).toBe("active");
    const newer1Row = await superuser.store.findUniqueOrThrow({ where: { id: newer1 } });
    expect(newer1Row.status).toBe("orders_paused");
    expect(newer1Row.overLimitPausedAt).not.toBeNull();
    const newer2Row = await superuser.store.findUniqueOrThrow({ where: { id: newer2 } });
    expect(newer2Row.status).toBe("orders_paused");
  });

  it("FR-6.43: an upgrade within 30 days reclaims over-limit-paused stores up to the new limit, oldest-paused first, and never deletes anything", async () => {
    const adminToken = await createAndLoginAdmin("downgrade-admin4@example.com");
    const seller = await signup("downgrade-reclaim@example.com");
    const kept = await createStore(seller.token, "downgrade-reclaim-1");
    await grantPlan(adminToken, seller.sellerId, 1); // RUN (max 3)
    const paused1 = await createStore(seller.token, "downgrade-reclaim-2");
    const paused2 = await createStore(seller.token, "downgrade-reclaim-3");
    await grantPlan(adminToken, seller.sellerId, 0); // GO (max 1) - pauses paused1/paused2

    for (const id of [paused1, paused2]) {
      const row = await superuser.store.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe("orders_paused");
    }

    // Upgrade back to RUN (max 3) within the 30-day window.
    await grantPlan(adminToken, seller.sellerId, 1);

    for (const id of [kept, paused1, paused2]) {
      const row = await superuser.store.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe("active");
      expect(row.overLimitPausedAt).toBeNull();
    }
  });

  it("FR-6.43: after the 30-day reclaim window elapses, an upgrade does NOT auto-restore the store - it stays paused, never deleted", async () => {
    const adminToken = await createAndLoginAdmin("downgrade-admin5@example.com");
    const seller = await signup("downgrade-expired-window@example.com");
    const kept = await createStore(seller.token, "downgrade-expired-1");
    await grantPlan(adminToken, seller.sellerId, 1); // RUN (max 3)
    const pausedStoreId = await createStore(seller.token, "downgrade-expired-2");
    await grantPlan(adminToken, seller.sellerId, 0); // GO (max 1) - pauses pausedStoreId

    // Back-date overLimitPausedAt past the 30-day window.
    await superuser.store.update({ where: { id: pausedStoreId }, data: { overLimitPausedAt: new Date(Date.now() - 31 * DAY_MS) } });

    await grantPlan(adminToken, seller.sellerId, 1); // upgrade back to RUN, well after the window

    const row = await superuser.store.findUniqueOrThrow({ where: { id: pausedStoreId } });
    expect(row.status).toBe("orders_paused"); // never auto-reclaimed
    expect(row.overLimitPausedAt).not.toBeNull(); // never deleted, no data lost

    const keptRow = await superuser.store.findUniqueOrThrow({ where: { id: kept } });
    expect(keptRow.status).toBe("active");
  });
});
