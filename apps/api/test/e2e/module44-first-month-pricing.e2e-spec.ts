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
 * v0.33/SRS "Plans & Pricing", updated for Module 61 (SRS §5.7, FR-7.20)
 * and renamed for Module 74 (v0.39, GO/RUN/RISE/FLY) - THEN REVERSED AGAIN
 * for §5.73/FR-73.1-73.2 (Global Launch Mandate, founder-confirmed
 * 2026-10-04): a new seller now starts on the permanent, never-billed
 * starter_free planGroup, not GO. GO/RUN/RISE/FLY are unchanged by this -
 * still real, paid, permanent-until-changed tiers with no auto-transition
 * - only what a BRAND-NEW seller starts on changed. This file's title and
 * tests are updated to match; the "no Free plan" framing this suite
 * originally proved (Module 61, still true) refers to the OLD, fully
 * removed pre-v0.33 mechanism (an auto-expiring trial that silently
 * reassigned itself) - starter_free is a deliberate, permanent, separate
 * planGroup, not a resurrection of that mechanism; see the last test in
 * this file for the explicit distinction.
 */
describe("Entry-tier assignment: starter_free at signup, GO+ permanent once chosen (e2e) - v0.33/Module 61, v0.39/Module 74, v0.62/§5.73", () => {
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

  /** Directly upgrades a freshly-signed-up (starter_free) seller to a real paid GO cycle - a superuser DB write, not the HTTP path, since these specific tests are about what happens to an ALREADY-paid subscription, not the upgrade itself (that's its own test below). */
  async function fastForwardToGo(sellerId: string, currentPeriodEnd: Date) {
    const go = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: go.id, currentPeriodEnd } });
    return go;
  }

  it("GO is still a real, paid, permanent tier; starter_free is a separate, deliberate, also-permanent free tier - neither is the old removed Free Plan", async () => {
    const freeNamed = await superuser.plan.findFirst({ where: { name: "Free" } });
    expect(freeNamed).toBeNull(); // the OLD pre-v0.33 mechanism's name - still gone

    const go = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    expect(go.name).toBe("GO");
    expect(Number(go.price)).toBeGreaterThan(0);
    expect(go.firstCyclePrice).toBeNull(); // dormant, see FR-74's own note - unaffected by this change

    const starterFree = await superuser.plan.findFirstOrThrow({ where: { planGroup: "starter_free", tierOrder: 0 } });
    expect(starterFree.name).toBe("Starter Free");
    expect(Number(starterFree.price)).toBe(0);
    expect(starterFree.billingInterval).toBe("none");

    // The supplier Free tier is a deliberately separate, legitimate concept
    // (FR-7.10) - untouched by this removal or by starter_free's addition.
    const supplierFree = await superuser.plan.findFirstOrThrow({ where: { planGroup: "supplier", tierOrder: 0 } });
    expect(supplierFree.name).toBe("Supplier Free");
  });

  it("SRS §5.73/FR-73.1-73.2 - signup assigns starter_free, never billed, no pending-plan auto-transition", async () => {
    const { sellerId } = await signup("free-signup@example.com");
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    const starterFree = await superuser.plan.findFirstOrThrow({ where: { planGroup: "starter_free", tierOrder: 0 } });

    expect(subscription.planId).toBe(starterFree.id);
    expect(subscription.pendingPlanId).toBeNull();
    expect(subscription.currentPeriodEnd).toBeNull(); // permanent, not a trial - FR-73.1
  });

  it("starter_free never auto-transitions to any other tier - applyDueCycleChanges() has nothing queued to apply, and a seller who never upgrades stays on it indefinitely", async () => {
    const { sellerId } = await signup("free-stays@example.com");
    const starterFree = await superuser.plan.findFirstOrThrow({ where: { planGroup: "starter_free", tierOrder: 0 } });

    const subscriptions = app.get(SubscriptionsService);
    const result = await subscriptions.applyDueCycleChanges(new Date());
    expect(result.applied).toBe(0);

    const after = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(after.planId).toBe(starterFree.id); // unchanged - permanent unless explicitly changed
    expect(after.pendingPlanId).toBeNull();
    expect(after.currentPeriodEnd).toBeNull(); // still no cycle - nothing to sweep
  });

  it("SRS §5.73 founder resolution (2026-10-04) - a starter_free subscription is never picked up by the plan-fee-debit sweep, by construction (null currentPeriodEnd fails the sweep's own `lte: now` filter, AND PlanFeeDebitService's per-row check explicitly skips any non-individual planGroup) - a free-tier store can never be paused for non-payment of a plan fee it was never going to be charged", async () => {
    const { sellerId, token } = await signup("free-never-paused@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Free Store", slug: "free-never-paused-store" });
    const storeId = store.body.id as string;

    const planFeeDebit = app.get(PlanFeeDebitService);
    // Run the sweep far enough in the future that, were this subscription
    // somehow swept, it would certainly be past any grace window.
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await planFeeDebit.runMonthlyDebitSweep(farFuture);

    const storeAfter = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(storeAfter.status).toBe("active"); // never touched

    const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscriptionAfter.currentPeriodEnd).toBeNull(); // still no cycle at all
  });

  it("SRS §5.73 founder resolution - a starter_free seller's first upgrade to GO applies immediately (no cycle to wait for), via the same requestPlanChange() path every other upgrade uses - no special-casing needed", async () => {
    const { token } = await signup("free-upgrades@example.com");
    const go = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });

    const res = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: go.id, billingInterval: "monthly" });

    expect(res.status).toBe(201);
    expect(res.body.requiresDowngradeConfirmation).toBeUndefined(); // free -> GO is an upgrade, never a downgrade warning
    expect(res.body.requiresStoreChoice).toBeUndefined();
    expect(res.body.planId).toBe(go.id); // applied immediately, not deferred to pendingPlanId
    expect(res.body.pendingPlanId).toBeNull();
    expect(res.body.currentPeriodEnd).not.toBeNull();
  });

  it("Module 73 (v0.38) - for a PAID (GO+) subscription, plan-fee expiry still pauses orders (orders_paused) only once the grace window elapses, never falls back to any other plan reassignment - unchanged by starter_free's addition", async () => {
    const { token, sellerId } = await signup("basic-expiry@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Expiry Store", slug: "basic-expiry-store" });
    const storeId = store.body.id as string;

    const cycleEnd = new Date(Date.now() - 1000);
    const go = await fastForwardToGo(sellerId, cycleEnd);

    const settings = app.get(SettingsService);
    const graceDays = await settings.resolve<number>("billing.plan_fee_grace_days");
    const planFeeDebit = app.get(PlanFeeDebitService);
    const pastGrace = new Date(cycleEnd.getTime() + (graceDays + 1) * 24 * 60 * 60 * 1000);
    await planFeeDebit.runMonthlyDebitSweep(pastGrace);

    const storeAfter = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(storeAfter.status).toBe("orders_paused");

    const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscriptionAfter.planId).toBe(go.id); // unchanged - never reassigned to any other plan, starter_free included
  });

  it("Module 73 (v0.38) - a verified plan-fee payment restores a paused store instantly", async () => {
    const { token, sellerId } = await signup("basic-restore@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Restore Store", slug: "basic-restore-store" });
    const storeId = store.body.id as string;

    const cycleEnd = new Date(Date.now() - 1000);
    await fastForwardToGo(sellerId, cycleEnd);

    const settings = app.get(SettingsService);
    const graceDays = await settings.resolve<number>("billing.plan_fee_grace_days");
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

  it("no code path can resolve the OLD, fully-removed pre-v0.33 Free plan for a seller - those methods no longer exist on SubscriptionsService (starter_free, added back in v0.62/§5.73, is a different, deliberate, separate mechanism - assignEntryTierAtSignup() now targets it by design, not a regression of this test's own premise)", async () => {
    const subscriptions = app.get(SubscriptionsService) as unknown as Record<string, unknown>;
    expect(subscriptions.assignFreePlanAtSignup).toBeUndefined();
    expect(subscriptions.scheduleDowngradeToFreeAtPeriodEnd).toBeUndefined();
    expect(typeof (subscriptions as unknown as SubscriptionsService).assignEntryTierAtSignup).toBe("function");
    expect(typeof (subscriptions as unknown as SubscriptionsService).scheduleDowngradeToFallbackTierAtPeriodEnd).toBe("function");
  });
});
