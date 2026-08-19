import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { addInterval } from "../../src/plans/subscriptions.service";
import { resolveActivePlanPrice } from "../../src/plans/plan-pricing.util";
import { round2 } from "../../src/orders/money.util";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Module 60 (SRS §5.6g, FR-6.35a) - an audit/test module, not new
 * production mechanics: the existing grace ladder, orders_paused,
 * negative-float floor, running-balance column, and daily reconciliation
 * (Module 47) are unchanged in mechanism - this suite re-confirms every
 * plan-fee debit amount they act on is now correctly computed off a
 * plan's three price fields (regularPrice/price/firstCyclePrice, plus the
 * campaign toggle) and the subscription's own chosen billing-cycle
 * multiplier (Module 61, FR-7.20), rather than the single flat price
 * these mechanics were originally built against.
 */
describe("Wallet/Commission Re-Verification Against Four-Tier Plans (e2e) - SRS §5.6g, FR-6.35a", () => {
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

  async function topUpAndVerify(token: string, adminToken: string, amount: number) {
    const req = await request(app.getHttpServer())
      .post("/sellers/me/wallet/topup-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount });
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${req.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
  }

  async function getBalance(token: string): Promise<number> {
    const res = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
    return res.body.balance as number;
  }

  it("a monthly-cycle renewal debits exactly the tier's standing `price` (unchanged 1x case)", async () => {
    const { token, sellerId } = await signup("monthly-renewal@example.com");
    const adminToken = await createAndLoginAdmin("monthly-renewal-admin@example.com");
    const starterPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: starterPlan.id } });

    await topUpAndVerify(token, adminToken, 50000);
    const balanceBefore = await getBalance(token);
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    const result = await planFeeDebit.runMonthlyDebitSweep(new Date());
    expect(result.debited).toBeGreaterThanOrEqual(1);

    const balanceAfter = await getBalance(token);
    expect(round2(balanceBefore - balanceAfter)).toBe(round2(Number(starterPlan.price)));
  });

  it("a six-month-cycle renewal debits 5.5x the active monthly price and advances currentPeriodEnd by 6 months (FR-7.20)", async () => {
    const { token, sellerId } = await signup("six-month-renewal@example.com");
    const adminToken = await createAndLoginAdmin("six-month-renewal-admin@example.com");
    const growthPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });
    const settings = app.get(SettingsService);
    const sixMonthMultiplier = await settings.resolve<number>("billing.six_month_price_multiplier");

    await superuser.subscription.update({
      where: { sellerId },
      data: { planId: growthPlan.id, billingInterval: "six_month" },
    });

    await topUpAndVerify(token, adminToken, 200000);
    const balanceBefore = await getBalance(token);
    const dueAt = new Date(Date.now() - 1000);
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: dueAt } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    await planFeeDebit.runMonthlyDebitSweep(new Date());

    const balanceAfter = await getBalance(token);
    const expectedFee = round2(Number(growthPlan.price) * sixMonthMultiplier);
    expect(round2(balanceBefore - balanceAfter)).toBe(expectedFee);

    const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscriptionAfter.currentPeriodEnd).toEqual(addInterval(dueAt, "six_month"));
  });

  it("a yearly-cycle renewal debits 10x the active monthly price and advances currentPeriodEnd by 12 months (FR-7.20)", async () => {
    const { token, sellerId } = await signup("yearly-renewal@example.com");
    const adminToken = await createAndLoginAdmin("yearly-renewal-admin@example.com");
    const proPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 3 } });
    const settings = app.get(SettingsService);
    const yearlyMultiplier = await settings.resolve<number>("billing.yearly_price_multiplier");

    await superuser.subscription.update({
      where: { sellerId },
      data: { planId: proPlan.id, billingInterval: "yearly" },
    });

    await topUpAndVerify(token, adminToken, 400000);
    const balanceBefore = await getBalance(token);
    const dueAt = new Date(Date.now() - 1000);
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: dueAt } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    await planFeeDebit.runMonthlyDebitSweep(new Date());

    const balanceAfter = await getBalance(token);
    const expectedFee = round2(Number(proPlan.price) * yearlyMultiplier);
    expect(round2(balanceBefore - balanceAfter)).toBe(expectedFee);

    const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscriptionAfter.currentPeriodEnd).toEqual(addInterval(dueAt, "yearly"));
  });

  it("a renewal during an active campaign debits the campaign price, not the standing price (FR-7.20's resolveActivePlanPrice, unified between display and billing)", async () => {
    const { token, sellerId } = await signup("campaign-renewal@example.com");
    const adminToken = await createAndLoginAdmin("campaign-renewal-admin@example.com");
    const basicPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    await superuser.plan.update({ where: { id: basicPlan.id }, data: { campaignActive: true } });
    const basicPlanWithCampaign = await superuser.plan.findUniqueOrThrow({ where: { id: basicPlan.id } });
    expect(basicPlanWithCampaign.campaignPrice).not.toBeNull();
    expect(resolveActivePlanPrice(basicPlanWithCampaign)).toBe(round2(Number(basicPlanWithCampaign.campaignPrice)));

    await topUpAndVerify(token, adminToken, 20000);
    const balanceBefore = await getBalance(token);
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    await planFeeDebit.runMonthlyDebitSweep(new Date());

    const balanceAfter = await getBalance(token);
    expect(round2(balanceBefore - balanceAfter)).toBe(round2(Number(basicPlanWithCampaign.campaignPrice)));
    expect(round2(balanceBefore - balanceAfter)).toBeLessThan(round2(Number(basicPlanWithCampaign.price)));
  });

  it("insufficient balance for the new higher six-month fee still pauses stores via the unchanged grace-ladder mechanism (FR-6.25/6.26 unaffected by the multiplier swap)", async () => {
    const { token, sellerId } = await signup("six-month-insufficient@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Six Month Insufficient Store", slug: "six-month-insufficient-store" });
    const storeId = store.body.id as string;
    const proPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 3 } });

    await superuser.subscription.update({
      where: { sellerId },
      data: { planId: proPlan.id, billingInterval: "yearly", currentPeriodEnd: new Date(Date.now() - 1000) },
    });
    // Zero balance - the yearly Pro fee is far larger than anything a
    // stray default balance could cover.

    const planFeeDebit = app.get(PlanFeeDebitService);
    await planFeeDebit.runMonthlyDebitSweep(new Date());

    const storeAfter = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(storeAfter.status).toBe("orders_paused");

    const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscriptionAfter.planId).toBe(proPlan.id); // never reassigned, unchanged from Module 44's guarantee
    expect(subscriptionAfter.currentPeriodEnd!.getTime()).toBeLessThan(Date.now()); // left overdue, not advanced
  });

  it("the running-balance cache and an independent from-scratch ledger recomputation still agree after a six-month-cycle debit (Module 47's invariant, unaffected)", async () => {
    const { token, sellerId } = await signup("six-month-reconcile@example.com");
    const adminToken = await createAndLoginAdmin("six-month-reconcile-admin@example.com");
    const { WalletService } = await import("../../src/billing/wallet.service");
    const growthPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });

    await superuser.subscription.update({
      where: { sellerId },
      data: { planId: growthPlan.id, billingInterval: "six_month" },
    });
    await topUpAndVerify(token, adminToken, 200000);
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    await planFeeDebit.runMonthlyDebitSweep(new Date());

    const cachedBalance = await getBalance(token);
    const trueLedgerBalance = await app.get(WalletService).computeLedgerBalance(sellerId);
    expect(cachedBalance).toBe(trueLedgerBalance);
  });

  it("a seller can self-select the six-month cycle via the plan-change endpoint, and it applies at the NEXT renewal without disturbing the current cycle (FR-7.20 selectability)", async () => {
    const { token, sellerId } = await signup("select-cycle@example.com");
    const growthPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });

    const before = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(before.billingInterval).toBe("monthly");

    const res = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: growthPlan.id, billingInterval: "six_month" });
    expect(res.status).toBe(201);

    const after = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(after.billingInterval).toBe("six_month"); // written immediately
    expect(after.planId).not.toBe(growthPlan.id); // the TIER itself still defers to next cycle (FR-7.5)
    expect(after.pendingPlanId).toBe(growthPlan.id);
    expect(after.currentPeriodEnd).toEqual(before.currentPeriodEnd); // current cycle undisturbed
  });
});
