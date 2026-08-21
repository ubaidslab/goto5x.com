import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { WalletGraceLadderService } from "../../src/billing/wallet-grace-ladder.service";
import { addInterval } from "../../src/plans/subscriptions.service";
import { resolveActivePlanPrice } from "../../src/plans/plan-pricing.util";
import { round2 } from "../../src/orders/money.util";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Module 73 (v0.38, SRS §5.6g amended) - subscription-only business model.
 * Commission stays intact-but-dormant at 0% (Module 74/75); the wallet is
 * hidden from every seller-facing surface. Supersedes Module 59's
 * (combined signup payment) and Module 60's (wallet-auto-debit
 * re-verification against four-tier plans) e2e suites, both of which
 * exercised mechanics this module retires - see plan-fee-debit.service.ts
 * and wallet.service.ts's updated docstrings for exactly what changed.
 *
 * The mechanism: a seller pays their plan fee - first cycle AND every
 * renewal after it - through the same WalletTopUpRequest/
 * AdminWalletController admin-verify flow Module 20/59 already built,
 * `planFeePortion`-only (never a bundled wallet top-up; `amount` is
 * always 0). A first-ever payment "activates" currentPeriodEnd fresh from
 * verification time, at the discounted firstCyclePrice; every payment
 * after that "advances" (stacks onto) the existing currentPeriodEnd, at
 * the full active (campaign-aware) price for the subscription's own
 * billing-cycle multiplier. Non-payment past `billing.plan_fee_grace_days`
 * pauses the seller's stores; a verified payment restores instantly.
 */
describe("Subscription-Only Renewal Mechanism (e2e) - SRS §5.6g amended, v0.38", () => {
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
    return { token, userId: user.id as string, sellerId: seller.id as string };
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

  async function payPlanFee(token: string, adminToken: string) {
    const submit = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const verify = await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${submit.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
    return { submit: submit.body, verify: verify.body };
  }

  async function getBalance(token: string): Promise<number> {
    const res = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
    return res.body.balance as number;
  }

  it("Module 74 (v0.39) - a first plan-fee payment previews at the Settings-driven first-cycle discount off the active price and activates currentPeriodEnd fresh from verification time", async () => {
    const { token, sellerId } = await signup("first-payment@example.com");
    const adminToken = await createAndLoginAdmin("first-payment-admin@example.com");
    const entryPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    const settings = app.get(SettingsService);
    const discountPercent = await settings.resolve<number>("billing.first_cycle_discount_percent");
    const expectedFirstCycle = round2(resolveActivePlanPrice(entryPlan) * (1 - discountPercent / 100));

    const preview = await request(app.getHttpServer())
      .get("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.isRenewal).toBe(false);
    expect(preview.body.amountDue).toBe(expectedFirstCycle);
    expect(preview.body.amountDue).toBeLessThan(round2(Number(entryPlan.price)));

    const before = new Date();
    const { submit, verify } = await payPlanFee(token, adminToken);
    const after = new Date();
    expect(verify.planFeePortion).not.toBeNull();
    expect(Number(verify.amount)).toBe(0); // never a wallet-credit portion any more

    // Never a wallet_topup_credit for a zero-amount request.
    const balance = await getBalance(token);
    expect(balance).toBe(0);
    const credits = await superuser.ledgerEntry.findMany({ where: { sellerId, type: "wallet_topup_credit" } });
    expect(credits).toHaveLength(0);

    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    const earliest = addInterval(before, "monthly");
    const latest = addInterval(after, "monthly");
    expect(subscription.currentPeriodEnd!.getTime()).toBeGreaterThanOrEqual(earliest.getTime());
    expect(subscription.currentPeriodEnd!.getTime()).toBeLessThanOrEqual(latest.getTime());
    expect(submit.amountDue).toBe(preview.body.amountDue);
  });

  it("a second payment previews the full active price (not the first-cycle discount) and ADVANCES (stacks onto) the existing currentPeriodEnd rather than resetting from now", async () => {
    const { token, sellerId } = await signup("renewal@example.com");
    const adminToken = await createAndLoginAdmin("renewal-admin@example.com");
    const basic = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });

    await payPlanFee(token, adminToken);
    const afterFirst = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });

    const preview = await request(app.getHttpServer())
      .get("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`);
    expect(preview.body.isRenewal).toBe(true);
    expect(preview.body.amountDue).toBe(round2(Number(basic.price))); // full price, no discount

    const { verify } = await payPlanFee(token, adminToken);
    expect(verify.planFeePortion).not.toBeNull();

    const afterSecond = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    const expected = addInterval(afterFirst.currentPeriodEnd!, "monthly");
    expect(afterSecond.currentPeriodEnd!.getTime()).toBe(expected.getTime());
  });

  it("a pending plan-fee request blocks a second submission, but a verified one never blocks the next cycle's request", async () => {
    const { token } = await signup("pending-guard@example.com");
    const adminToken = await createAndLoginAdmin("pending-guard-admin@example.com");

    const first = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(first.status).toBe(201);

    const secondWhilePending = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(secondWhilePending.status).toBe(400);

    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${first.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);

    const afterVerified = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(afterVerified.status).toBe(201); // a verified request never blocks the next cycle
  });

  it("a renewal during an active campaign previews the campaign price, and a six-month interval multiplies it by the six-month multiplier (Module 61 unified with the new payment mechanism)", async () => {
    const { token } = await signup("campaign-six-month@example.com");
    const adminToken = await createAndLoginAdmin("campaign-six-month-admin@example.com");
    const settings = app.get(SettingsService);
    const sixMonthMultiplier = await settings.resolve<number>("billing.six_month_price_multiplier");

    await payPlanFee(token, adminToken); // first payment, discounted

    const basic = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    // Module 74 (v0.39) - GO no longer seeds a real campaignPrice (the
    // founder gave no promotional figure to seed); inject a test-owned
    // value to prove the mechanism, same pattern as the commission tests
    // above.
    const testCampaignPrice = 999;
    await superuser.plan.update({ where: { id: basic.id }, data: { campaignActive: true, campaignPrice: testCampaignPrice } });
    await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${token}`)
      .send({ planId: basic.id, billingInterval: "six_month" });

    const preview = await request(app.getHttpServer())
      .get("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`);
    expect(preview.body.isRenewal).toBe(true);
    expect(preview.body.amountDue).toBe(round2(testCampaignPrice * sixMonthMultiplier));
  });

  it("referral commission accrues on both the first payment AND every renewal after it (FR-33.4, one call site now: AdminWalletController.verify())", async () => {
    const referrer = await signup("referrer@example.com");
    const referred = await signup("referred@example.com");
    const adminToken = await createAndLoginAdmin("referral-admin@example.com");

    // Module 79 (v0.39) moved Ambassador to a flat, RENEWAL-only model
    // (never the first payment) - this test's actual point is the call-
    // site consolidation ("accrues on BOTH first payment and every
    // renewal, from exactly one place"), which the still-unchanged
    // Creator program (percent-of-every-payment, no first-vs-renewal
    // distinction) demonstrates just as well.
    const participant = await superuser.programParticipant.create({
      data: { sellerId: referrer.sellerId, programType: "creator", status: "approved" },
    });
    await superuser.referralAttribution.create({
      data: {
        referredSellerId: referred.sellerId,
        participantId: participant.id,
        programType: "creator",
        commissionWindowEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      },
    });

    const settings = app.get(SettingsService);
    const ratePercent = await settings.resolve<number>("growth.student_creator_commission_percent");

    const { submit: firstSubmit } = await payPlanFee(referred.token, adminToken);
    const balanceAfterFirst = await getBalance(referrer.token);
    expect(balanceAfterFirst).toBe(round2((firstSubmit.amountDue * ratePercent) / 100));

    const { submit: secondSubmit } = await payPlanFee(referred.token, adminToken);
    const balanceAfterSecond = await getBalance(referrer.token);
    const expectedTotal = round2(((firstSubmit.amountDue + secondSubmit.amountDue) * ratePercent) / 100);
    expect(balanceAfterSecond).toBe(expectedTotal);

    const commissionEntries = await superuser.ledgerEntry.findMany({
      where: { sellerId: referrer.sellerId, type: "program_commission_credit" },
    });
    expect(commissionEntries).toHaveLength(2);
  });

  it("the grace-day sweep does not pause within the grace window, pauses once it elapses with no verified renewal, and a verified payment restores instantly", async () => {
    const { token, sellerId } = await signup("grace-sweep@example.com");
    const adminToken = await createAndLoginAdmin("grace-sweep-admin@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Grace Sweep Store", slug: "grace-sweep-store" });
    const storeId = store.body.id as string;

    await payPlanFee(token, adminToken); // establish a real paid cycle first
    const settings = app.get(SettingsService);
    const graceDays = await settings.resolve<number>("billing.plan_fee_grace_days");

    // Back-date the cycle end to just past due, but still inside grace.
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });

    const planFeeDebit = app.get(PlanFeeDebitService);
    await planFeeDebit.runMonthlyDebitSweep(new Date());
    const storeWithinGrace = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(storeWithinGrace.status).toBe("active"); // still within grace - not overdue yet

    // Advance past the grace deadline and sweep again.
    const pastGrace = new Date(Date.now() + (graceDays + 1) * 24 * 60 * 60 * 1000);
    await planFeeDebit.runMonthlyDebitSweep(pastGrace);
    const storePaused = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(storePaused.status).toBe("orders_paused");

    // A verified renewal restores instantly - no admin action needed beyond the verify itself.
    await payPlanFee(token, adminToken);
    const storeRestored = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(storeRestored.status).toBe("active");
  });

  it("restoreAfterPlanFeePayment() is unconditional (payment verification alone is the gate) for stores paused for non-payment - proven directly against WalletGraceLadderService", async () => {
    const { token, sellerId } = await signup("restore-unconditional@example.com");
    await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Restore Store", slug: "restore-unconditional-store" });
    // Module 64 (FR-6.41) added terminalPausedAt as the specific non-payment
    // pause-reason marker, scoping restoreAfterPlanFeePayment() to exactly
    // the stores it paused - so simulating that pause reason here means
    // setting it too, the same as the real pauseActiveStoresForNonPayment()
    // path would.
    await superuser.store.updateMany({ where: { sellerId }, data: { status: "orders_paused", terminalPausedAt: new Date() } });

    const graceLadder = app.get(WalletGraceLadderService);
    await graceLadder.restoreAfterPlanFeePayment(sellerId);

    const stores = await superuser.store.findMany({ where: { sellerId } });
    expect(stores.every((s) => s.status === "active")).toBe(true);
  });
});
