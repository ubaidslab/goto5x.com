import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SubscriptionsService } from "../../src/plans/subscriptions.service";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * v0.33/SRS "Plans & Pricing" (deep-audit Phase A, item 1) - the founder's
 * explicit test list for Module 44: no Free Plan anywhere, signup assigns
 * First Month with a real cycle, First Month auto-transitions to Starter,
 * plan-fee expiry pauses orders (never a Free-Plan reassignment), a
 * verified top-up restores a plan-fee-paused store, and no code path can
 * still resolve a Free plan.
 */
describe("First Month entry pricing - no Free Plan (e2e) - v0.33", () => {
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

  it("there is no Free plan anywhere in the seeded plan data - individual tierOrder 0 is First Month, a real paid tier", async () => {
    const freeNamed = await superuser.plan.findFirst({ where: { name: "Free" } });
    expect(freeNamed).toBeNull();

    const firstMonth = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    expect(firstMonth.name).toBe("First Month");
    expect(Number(firstMonth.price)).toBeGreaterThan(0);

    // The supplier Free tier is a deliberately separate, legitimate concept
    // (FR-7.10) - untouched by this removal.
    const supplierFree = await superuser.plan.findFirstOrThrow({ where: { planGroup: "supplier", tierOrder: 0 } });
    expect(supplierFree.name).toBe("Supplier Free");
  });

  it("signup assigns First Month with a real billing cycle and Starter already queued as the next-cycle target - never a Free Plan / no-cycle subscription", async () => {
    const { sellerId } = await signup("first-month-signup@example.com");
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    const firstMonth = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    const starter = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } });

    expect(subscription.planId).toBe(firstMonth.id);
    expect(subscription.pendingPlanId).toBe(starter.id);
    expect(subscription.currentPeriodEnd).not.toBeNull();
  });

  it("auto-transitions First Month to Starter at the cycle's end via the existing pendingPlanId sweep (FR-7.5) - no separate transition mechanism", async () => {
    const { sellerId } = await signup("first-month-transition@example.com");
    const starter = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } });

    // Back-date the cycle end so the sweep treats it as due.
    const past = new Date(Date.now() - 1000);
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: past } });

    const subscriptions = app.get(SubscriptionsService);
    const result = await subscriptions.applyDueCycleChanges(new Date());
    expect(result.applied).toBeGreaterThanOrEqual(1);

    const after = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(after.planId).toBe(starter.id);
    expect(after.pendingPlanId).toBeNull();
    expect(after.currentPeriodEnd).not.toBeNull();
    expect(after.currentPeriodEnd!.getTime()).toBeGreaterThan(past.getTime());
  });

  it("plan-fee expiry pauses orders (orders_paused) - never falls back to a Free plan reassignment", async () => {
    const { token, sellerId } = await signup("first-month-expiry@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Expiry Store", slug: "first-month-expiry-store" });
    const storeId = store.body.id as string;

    const planBefore = (await superuser.subscription.findUniqueOrThrow({ where: { sellerId } })).planId;

    // Force the cycle due against an empty wallet (default balance is 0).
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    await planFeeDebit.runMonthlyDebitSweep(new Date());

    const storeAfter = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(storeAfter.status).toBe("orders_paused");

    const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscriptionAfter.planId).toBe(planBefore); // unchanged - never reassigned to any other plan
  });

  it("a verified top-up restores a plan-fee-paused store, through the same wallet-grace-ladder restore path", async () => {
    const { token, sellerId } = await signup("first-month-restore@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Restore Store", slug: "first-month-restore-store" });
    const storeId = store.body.id as string;

    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    await planFeeDebit.runMonthlyDebitSweep(new Date());
    const pausedStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(pausedStore.status).toBe("orders_paused");

    const adminToken = await createAndLoginAdmin("first-month-restore-admin@example.com");
    const topUp = await request(app.getHttpServer())
      .post("/sellers/me/wallet/topup-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 10000 });
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${topUp.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);

    const restoredStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(restoredStore.status).toBe("active");
  });

  it("no code path can resolve a Free plan for a seller - the old Free-Plan methods no longer exist on SubscriptionsService", async () => {
    const subscriptions = app.get(SubscriptionsService) as unknown as Record<string, unknown>;
    expect(subscriptions.assignFreePlanAtSignup).toBeUndefined();
    expect(subscriptions.scheduleDowngradeToFreeAtPeriodEnd).toBeUndefined();
    expect(typeof (subscriptions as unknown as SubscriptionsService).assignFirstMonthAtSignup).toBe("function");
    expect(typeof (subscriptions as unknown as SubscriptionsService).scheduleDowngradeToStarterAtPeriodEnd).toBe("function");
  });
});
