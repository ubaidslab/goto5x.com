import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { resolveActivePlanPrice } from "../../src/plans/plan-pricing.util";
import { round2 } from "../../src/orders/money.util";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * SRS §5.6k (v0.41), FR-6.40 (Module 63) - MRR analytics, computed live
 * against Subscription/Plan and verified WalletTopUpRequest rows (not
 * LedgerEntry - see wallet.service.ts's own documented "never posts a
 * wallet_plan_fee_debit for the plan-fee portion" behavior).
 */
describe("MRR analytics (e2e) - SRS §5.6k/§14.66 (Module 63, FR-6.40)", () => {
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

  async function payPlanFee(token: string, adminToken: string) {
    const submit = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${submit.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
  }

  it("MRR sums active paid subscriptions at their standing (non-first-cycle-discounted) price, grouped correctly by tier", async () => {
    const adminToken = await createAndLoginAdmin("mrr-admin1@example.com");
    const a = await signup("mrr-a@example.com");
    const b = await signup("mrr-b@example.com");
    await payPlanFee(a.token, adminToken);
    await payPlanFee(b.token, adminToken);

    const entryPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    const standingMonthly = resolveActivePlanPrice(entryPlan);

    const res = await request(app.getHttpServer()).get("/admin/analytics/mrr").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.mrr).toBe(round2(standingMonthly * 2));
    expect(res.body.activeSubscriptionsByTier[entryPlan.name]).toBe(2);
    expect(res.body.activeSubscriptionCount).toBe(2);
  });

  it("first-cycle-to-full conversion rate counts only sellers with 2+ verified plan-fee payments as converted", async () => {
    const adminToken = await createAndLoginAdmin("mrr-admin2@example.com");
    const renewed = await signup("mrr-renewed@example.com");
    const firstCycleOnly = await signup("mrr-first-only@example.com");
    await payPlanFee(renewed.token, adminToken);
    await payPlanFee(renewed.token, adminToken); // renewal - second verified payment
    await payPlanFee(firstCycleOnly.token, adminToken); // only ever pays once

    const res = await request(app.getHttpServer()).get("/admin/analytics/mrr").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    // 1 of 2 sellers with any payment has a second (renewal) payment = 50%.
    expect(res.body.firstCycleToFullConversionRatePercent).toBe(50);
  });

  it("a subscription with currentPeriodEnd already in the past counts as expired-not-renewed, not toward MRR or upcoming renewals", async () => {
    const adminToken = await createAndLoginAdmin("mrr-admin3@example.com");
    const seller = await signup("mrr-expired@example.com");
    await payPlanFee(seller.token, adminToken);
    await superuser.subscription.update({
      where: { sellerId: seller.sellerId },
      data: { currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const res = await request(app.getHttpServer()).get("/admin/analytics/mrr").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.expiredNotRenewedCount).toBe(1);
    expect(res.body.activeSubscriptionCount).toBe(0);
    expect(res.body.mrr).toBe(0);
    expect(res.body.upcomingRenewals7d).toBe(0);
  });

  it("a subscription renewing within the next 7 days counts toward both the 7-day and 30-day upcoming-renewal windows", async () => {
    const adminToken = await createAndLoginAdmin("mrr-admin4@example.com");
    const seller = await signup("mrr-renewing-soon@example.com");
    await payPlanFee(seller.token, adminToken);
    await superuser.subscription.update({
      where: { sellerId: seller.sellerId },
      data: { currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    });

    const res = await request(app.getHttpServer()).get("/admin/analytics/mrr").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.upcomingRenewals7d).toBe(1);
    expect(res.body.upcomingRenewals30d).toBe(1);
  });

  it("realized revenue this month/quarter sums only verified plan-fee payments verified within the calendar window, unlike expectedRevenueThisMonth's projection", async () => {
    const adminToken = await createAndLoginAdmin("mrr-admin6@example.com");
    const seller = await signup("mrr-realized@example.com");
    await payPlanFee(seller.token, adminToken);

    const payment = await superuser.walletTopUpRequest.findFirstOrThrow({ where: { ownerId: seller.sellerId, planFeePortion: { not: null } } });

    const res = await request(app.getHttpServer()).get("/admin/analytics/mrr").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.realizedRevenueThisMonth).toBeCloseTo(Number(payment.planFeePortion), 1);
    expect(res.body.realizedRevenueThisQuarter).toBeCloseTo(Number(payment.planFeePortion), 1);
  });

  it("a verified plan-fee payment from last calendar quarter does not count toward this quarter's realized revenue", async () => {
    const adminToken = await createAndLoginAdmin("mrr-admin7@example.com");
    const seller = await signup("mrr-old-quarter@example.com");
    await payPlanFee(seller.token, adminToken);

    const payment = await superuser.walletTopUpRequest.findFirstOrThrow({ where: { ownerId: seller.sellerId, planFeePortion: { not: null } } });
    await superuser.walletTopUpRequest.update({ where: { id: payment.id }, data: { verifiedAt: new Date("2020-01-15T00:00:00Z") } });

    const res = await request(app.getHttpServer()).get("/admin/analytics/mrr").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.realizedRevenueThisMonth).toBe(0);
    expect(res.body.realizedRevenueThisQuarter).toBe(0);
  });

  it("no active subscriptions reports zero rates and a null LTV estimate, not a divide-by-zero error", async () => {
    const adminToken = await createAndLoginAdmin("mrr-admin5@example.com");
    const res = await request(app.getHttpServer()).get("/admin/analytics/mrr").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.mrr).toBe(0);
    expect(res.body.churnRatePercent).toBe(0);
    expect(res.body.arps).toBe(0);
    expect(res.body.ltvEstimate).toBeNull();
    expect(res.body.firstCycleToFullConversionRatePercent).toBe(0);
  });
});
