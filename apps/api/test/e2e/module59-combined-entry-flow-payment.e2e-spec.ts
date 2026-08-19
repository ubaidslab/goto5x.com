import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { addInterval } from "../../src/plans/subscriptions.service";
import { round2 } from "../../src/orders/money.util";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Module 59 (SRS §5.6g, FR-6.33). The wallet is not hidden - a new seller
 * pays their plan's first-cycle fee AND a minimum wallet top-up together,
 * in one combined transaction, via the exact WalletTopUpRequest/
 * AdminWalletController mechanism Module 20 already built (extended with a
 * `planFeePortion` field), rather than a second payment/claim system.
 */
describe("Combined Entry-Flow Payment (e2e) - SRS §5.6g, FR-6.33", () => {
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

  async function getBalance(token: string): Promise<number> {
    const res = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
    return res.body.balance as number;
  }

  it("preview shows the plan's first-cycle price + the minimum signup top-up as one combined total (FR-6.33)", async () => {
    const { token, sellerId } = await signup("preview@example.com");
    const settings = app.get(SettingsService);
    const topUpMin = await settings.resolve<number>("billing.minimum_signup_wallet_topup");
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId }, include: { plan: true } });

    const preview = await request(app.getHttpServer())
      .get("/sellers/me/wallet/signup-payment")
      .set("Authorization", `Bearer ${token}`);

    expect(preview.status).toBe(200);
    // Module 61 (FR-7.20) - the plan-fee portion is the tier's
    // firstCyclePrice, a genuine discount below its standing price.
    expect(preview.body.planFeePortion).toBe(round2(Number(subscription.plan.firstCyclePrice)));
    expect(preview.body.planFeePortion).toBeLessThan(round2(Number(subscription.plan.price)));
    expect(preview.body.topUpPortion).toBe(topUpMin);
    expect(preview.body.total).toBe(round2(Number(subscription.plan.firstCyclePrice) + topUpMin));
  });

  it("submits one proof-of-payment for the combined total, and a second submission while pending is rejected (FR-6.33)", async () => {
    const { token, sellerId } = await signup("submit@example.com");

    const submit = await request(app.getHttpServer())
      .post("/sellers/me/wallet/signup-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(submit.status).toBe(201);
    expect(submit.body.instructions).toBeTruthy();

    const stored = await superuser.walletTopUpRequest.findFirstOrThrow({ where: { ownerId: sellerId } });
    expect(stored.status).toBe("pending");
    expect(Number(stored.amount)).toBe(submit.body.topUpPortion);
    expect(Number(stored.planFeePortion)).toBe(submit.body.planFeePortion);

    const secondAttempt = await request(app.getHttpServer())
      .post("/sellers/me/wallet/signup-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(secondAttempt.status).toBe(400);

    // An ordinary top-up request is a totally separate mechanism and is unaffected.
    const ordinaryTopUp = await request(app.getHttpServer())
      .post("/sellers/me/wallet/topup-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 250 });
    expect(ordinaryTopUp.status).toBe(201);
  });

  it("verifying the combined request, in one commit, credits ONLY the top-up portion to the wallet and activates Subscription.currentPeriodEnd for one interval from verification time (never a wallet_plan_fee_debit for the plan-fee portion)", async () => {
    const { token, sellerId } = await signup("verify@example.com");
    const adminToken = await createAndLoginAdmin("verify-admin@example.com");

    const submit = await request(app.getHttpServer())
      .post("/sellers/me/wallet/signup-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const requestId = submit.body.request.id as string;
    const planFeePortion = submit.body.planFeePortion as number;
    const topUpPortion = submit.body.topUpPortion as number;

    const before = new Date();
    const verify = await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${requestId}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(verify.status).toBe(201);
    const after = new Date();

    // Only the top-up portion ever entered the wallet - never a
    // wallet_plan_fee_debit for the plan-fee portion, which paid the cycle
    // directly instead of being debited FROM the wallet.
    const balance = await getBalance(token);
    expect(balance).toBe(topUpPortion);
    const planFeeDebits = await superuser.ledgerEntry.findMany({ where: { sellerId, type: "wallet_plan_fee_debit" } });
    expect(planFeeDebits).toHaveLength(0);
    const topUpCredits = await superuser.ledgerEntry.findMany({ where: { sellerId, type: "wallet_topup_credit" } });
    expect(topUpCredits).toHaveLength(1);
    expect(Number(topUpCredits[0].amount)).toBe(topUpPortion);

    // The subscription's real, paid clock starts at verification time (not
    // stacked on top of the free placeholder period signup already granted).
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId }, include: { plan: true } });
    const expectedEarliest = addInterval(before, subscription.plan.billingInterval as "monthly" | "yearly");
    const expectedLatest = addInterval(after, subscription.plan.billingInterval as "monthly" | "yearly");
    expect(subscription.currentPeriodEnd!.getTime()).toBeGreaterThanOrEqual(expectedEarliest.getTime());
    expect(subscription.currentPeriodEnd!.getTime()).toBeLessThanOrEqual(expectedLatest.getTime());

    expect(planFeePortion).toBeGreaterThan(0);
  });

  it("verifying a combined request also accrues referral commission on the plan-fee portion, for a seller with an active referral attribution (FR-33.4 extended to the first cycle)", async () => {
    const referrer = await signup("referrer@example.com");
    const referred = await signup("referred@example.com");
    const adminToken = await createAndLoginAdmin("referral-admin@example.com");

    const participant = await superuser.programParticipant.create({
      data: { sellerId: referrer.sellerId, programType: "ambassador", status: "approved" },
    });
    await superuser.referralAttribution.create({
      data: {
        referredSellerId: referred.sellerId,
        participantId: participant.id,
        programType: "ambassador",
        commissionWindowEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });

    const settings = app.get(SettingsService);
    const ratePercent = await settings.resolve<number>("growth.ambassador_commission_percent");

    const submit = await request(app.getHttpServer())
      .post("/sellers/me/wallet/signup-payment")
      .set("Authorization", `Bearer ${referred.token}`)
      .send({});
    const planFeePortion = submit.body.planFeePortion as number;

    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${submit.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);

    const referrerBalance = await getBalance(referrer.token);
    expect(referrerBalance).toBe(round2((planFeePortion * ratePercent) / 100));

    const commissionEntry = await superuser.ledgerEntry.findFirstOrThrow({
      where: { sellerId: referrer.sellerId, type: "program_commission_credit" },
    });
    expect(Number(commissionEntry.amount)).toBe(round2((planFeePortion * ratePercent) / 100));
  });

  it("a rejected combined request may be resubmitted, and once rejected/never combined, an ordinary renewal sweep is unaffected", async () => {
    const { token, sellerId } = await signup("reject-resubmit@example.com");
    const adminToken = await createAndLoginAdmin("reject-resubmit-admin@example.com");

    const submit1 = await request(app.getHttpServer())
      .post("/sellers/me/wallet/signup-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${submit1.body.request.id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`);

    const subscriptionAfterReject = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    // Rejecting credits/activates nothing.
    const balanceAfterReject = await getBalance(token);
    expect(balanceAfterReject).toBe(0);

    const submit2 = await request(app.getHttpServer())
      .post("/sellers/me/wallet/signup-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(submit2.status).toBe(201);

    const verify2 = await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${submit2.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(verify2.status).toBe(201);
    const balanceAfterVerify = await getBalance(token);
    expect(balanceAfterVerify).toBe(submit2.body.topUpPortion);

    const subscriptionAfterVerify = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscriptionAfterVerify.currentPeriodEnd!.getTime()).toBeGreaterThan(subscriptionAfterReject.currentPeriodEnd!.getTime());
  });
});
