import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SubscriptionsService } from "../../src/plans/subscriptions.service";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * v0.33/SRS "Plans & Pricing", updated for Module 61 (SRS §5.7, FR-7.20):
 * no Free Plan anywhere, signup assigns Basic with a real billing cycle,
 * Basic is now a PERMANENT tier (the old auto-transition-to-Starter
 * mechanism this suite originally proved is retired - a seller stays on
 * Basic indefinitely unless they explicitly request a change), plan-fee
 * expiry pauses orders (never a Free-Plan reassignment), a verified
 * top-up restores a plan-fee-paused store, and no code path can still
 * resolve a Free plan.
 */
describe("Basic entry-tier pricing - no Free Plan, no forced tier transition (e2e) - v0.33/Module 61", () => {
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

  it("there is no Free plan anywhere in the seeded plan data - individual tierOrder 0 is Basic, a real paid tier", async () => {
    const freeNamed = await superuser.plan.findFirst({ where: { name: "Free" } });
    expect(freeNamed).toBeNull();

    const basic = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    expect(basic.name).toBe("Basic");
    expect(Number(basic.price)).toBeGreaterThan(0);
    expect(Number(basic.firstCyclePrice)).toBeGreaterThan(0);
    expect(Number(basic.firstCyclePrice)).toBeLessThan(Number(basic.price));

    // The supplier Free tier is a deliberately separate, legitimate concept
    // (FR-7.10) - untouched by this removal.
    const supplierFree = await superuser.plan.findFirstOrThrow({ where: { planGroup: "supplier", tierOrder: 0 } });
    expect(supplierFree.name).toBe("Supplier Free");
  });

  it("signup assigns Basic with a real billing cycle and NO pending-plan auto-transition (Module 61 retires the old First-Month-to-Starter mechanism)", async () => {
    const { sellerId } = await signup("basic-signup@example.com");
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    const basic = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });

    expect(subscription.planId).toBe(basic.id);
    expect(subscription.pendingPlanId).toBeNull();
    expect(subscription.currentPeriodEnd).not.toBeNull();
  });

  it("Basic never auto-transitions to Starter at cycle end - applyDueCycleChanges() has nothing queued to apply, and the seller stays on Basic", async () => {
    const { sellerId } = await signup("basic-stays@example.com");
    const basic = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });

    // Back-date the cycle end - if any pendingPlanId WERE queued, this is
    // exactly when the sweep would apply it.
    const past = new Date(Date.now() - 1000);
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: past } });

    const subscriptions = app.get(SubscriptionsService);
    const result = await subscriptions.applyDueCycleChanges(new Date());
    expect(result.applied).toBe(0);

    const after = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(after.planId).toBe(basic.id); // unchanged - Basic is permanent unless explicitly changed
    expect(after.pendingPlanId).toBeNull();
    expect(after.currentPeriodEnd).toEqual(past); // untouched - nothing was due to apply
  });

  it("Module 73 (v0.38) - plan-fee expiry pauses orders (orders_paused) only once the grace window elapses, never falls back to a Free plan reassignment", async () => {
    const { token, sellerId } = await signup("basic-expiry@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Expiry Store", slug: "basic-expiry-store" });
    const storeId = store.body.id as string;

    const planBefore = (await superuser.subscription.findUniqueOrThrow({ where: { sellerId } })).planId;
    const settings = app.get(SettingsService);
    const graceDays = await settings.resolve<number>("billing.plan_fee_grace_days");

    // Force the cycle due, with no verified renewal payment.
    const cycleEnd = new Date(Date.now() - 1000);
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: cycleEnd } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    const pastGrace = new Date(cycleEnd.getTime() + (graceDays + 1) * 24 * 60 * 60 * 1000);
    await planFeeDebit.runMonthlyDebitSweep(pastGrace);

    const storeAfter = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(storeAfter.status).toBe("orders_paused");

    const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscriptionAfter.planId).toBe(planBefore); // unchanged - never reassigned to any other plan
  });

  it("Module 73 (v0.38) - a verified plan-fee payment restores a paused store instantly", async () => {
    const { token, sellerId } = await signup("basic-restore@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Restore Store", slug: "basic-restore-store" });
    const storeId = store.body.id as string;

    const settings = app.get(SettingsService);
    const graceDays = await settings.resolve<number>("billing.plan_fee_grace_days");
    const cycleEnd = new Date(Date.now() - 1000);
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: cycleEnd } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    const pastGrace = new Date(cycleEnd.getTime() + (graceDays + 1) * 24 * 60 * 60 * 1000);
    await planFeeDebit.runMonthlyDebitSweep(pastGrace);
    const pausedStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(pausedStore.status).toBe("orders_paused");

    const adminToken = await createAndLoginAdmin("basic-restore-admin@example.com");
    const submit = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${submit.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);

    const restoredStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(restoredStore.status).toBe("active");
  });

  it("no code path can resolve a Free plan for a seller - the old Free-Plan methods no longer exist on SubscriptionsService", async () => {
    const subscriptions = app.get(SubscriptionsService) as unknown as Record<string, unknown>;
    expect(subscriptions.assignFreePlanAtSignup).toBeUndefined();
    expect(subscriptions.scheduleDowngradeToFreeAtPeriodEnd).toBeUndefined();
    expect(typeof (subscriptions as unknown as SubscriptionsService).assignBasicPlanAtSignup).toBe("function");
    expect(typeof (subscriptions as unknown as SubscriptionsService).scheduleDowngradeToStarterAtPeriodEnd).toBe("function");
  });
});
