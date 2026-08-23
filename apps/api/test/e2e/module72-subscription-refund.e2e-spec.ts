import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SRS §5.6k (v0.41), FR-6.49 (Module 72) - the 50% subscription refund
 * policy: admin-actioned cancellation with a required reason, a one-time
 * refund_adjustment wallet credit for a qualifying first-cycle
 * cancellation, and every disqualifying condition (already renewed,
 * outside the window, already refunded once).
 */
describe("Subscription refund policy (e2e) - SRS §5.6k/§14.66 (Module 72, FR-6.49)", () => {
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

  it("FR-6.49: cancelling without a reason is rejected", async () => {
    const adminToken = await createAndLoginAdmin("refund-admin1@example.com");
    const seller = await signup("refund-noreason@example.com");
    const res = await request(app.getHttpServer())
      .post(`/admin/sellers/${seller.sellerId}/subscription/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "" });
    expect(res.status).toBe(400);
  });

  it("FR-6.49: a qualifying first-cycle cancellation posts a 50% refund_adjustment credit and cancels the subscription, audit-logged", async () => {
    const adminToken = await createAndLoginAdmin("refund-admin2@example.com");
    const seller = await signup("refund-qualifying@example.com");
    await payPlanFee(seller.token, adminToken);

    const payment = await superuser.walletTopUpRequest.findFirstOrThrow({ where: { ownerId: seller.sellerId, planFeePortion: { not: null } } });
    const expectedRefund = Number((Number(payment.planFeePortion) * 0.5).toFixed(2));

    const cancel = await request(app.getHttpServer())
      .post(`/admin/sellers/${seller.sellerId}/subscription/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Seller requested a refund within the window." });
    expect(cancel.status).toBe(201);
    expect(cancel.body.status).toBe("cancelled");
    expect(cancel.body.refunded).toBe(true);
    expect(Number(cancel.body.refundAmount)).toBeCloseTo(expectedRefund, 1);

    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    expect(subscription.status).toBe("cancelled");
    expect(subscription.firstCycleRefundedAt).not.toBeNull();

    const ledgerEntry = await superuser.ledgerEntry.findFirstOrThrow({ where: { sellerId: seller.sellerId, type: "refund_adjustment" } });
    expect(Number(ledgerEntry.amount)).toBeCloseTo(-expectedRefund, 1); // negative, a credit back

    const auditRow = await superuser.adminAuditLog.findFirst({ where: { action: "billing.subscription_cancelled", targetId: subscription.id } });
    expect(auditRow).not.toBeNull();
  });

  it("FR-6.49: cancelling a second time is rejected (already cancelled), and never double-refunds", async () => {
    const adminToken = await createAndLoginAdmin("refund-admin3@example.com");
    const seller = await signup("refund-double@example.com");
    await payPlanFee(seller.token, adminToken);
    await request(app.getHttpServer())
      .post(`/admin/sellers/${seller.sellerId}/subscription/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "First cancellation." });

    const secondCancel = await request(app.getHttpServer())
      .post(`/admin/sellers/${seller.sellerId}/subscription/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Second attempt." });
    expect(secondCancel.status).toBe(400);

    const refunds = await superuser.ledgerEntry.findMany({ where: { sellerId: seller.sellerId, type: "refund_adjustment" } });
    expect(refunds).toHaveLength(1);
  });

  it("FR-6.49: a seller who already renewed (past the first cycle) does not qualify for a refund on cancellation", async () => {
    const adminToken = await createAndLoginAdmin("refund-admin4@example.com");
    const seller = await signup("refund-renewed@example.com");
    await payPlanFee(seller.token, adminToken); // first cycle
    await payPlanFee(seller.token, adminToken); // renewal - now on their second verified payment

    const cancel = await request(app.getHttpServer())
      .post(`/admin/sellers/${seller.sellerId}/subscription/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Cancelling after renewal." });
    expect(cancel.status).toBe(201);
    expect(cancel.body.refunded).toBe(false);
    expect(cancel.body.refundAmount).toBeNull();

    const refunds = await superuser.ledgerEntry.findMany({ where: { sellerId: seller.sellerId, type: "refund_adjustment" } });
    expect(refunds).toHaveLength(0);
  });

  it("FR-6.49: a cancellation outside the refund window does not qualify", async () => {
    const adminToken = await createAndLoginAdmin("refund-admin5@example.com");
    const seller = await signup("refund-expired-window@example.com");
    await payPlanFee(seller.token, adminToken);

    const payment = await superuser.walletTopUpRequest.findFirstOrThrow({ where: { ownerId: seller.sellerId, planFeePortion: { not: null } } });
    await superuser.walletTopUpRequest.update({ where: { id: payment.id }, data: { verifiedAt: new Date(Date.now() - 8 * DAY_MS) } }); // window default is 7 days

    const cancel = await request(app.getHttpServer())
      .post(`/admin/sellers/${seller.sellerId}/subscription/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Too late for a refund." });
    expect(cancel.status).toBe(201);
    expect(cancel.body.refunded).toBe(false);

    const refunds = await superuser.ledgerEntry.findMany({ where: { sellerId: seller.sellerId, type: "refund_adjustment" } });
    expect(refunds).toHaveLength(0);
  });
});
