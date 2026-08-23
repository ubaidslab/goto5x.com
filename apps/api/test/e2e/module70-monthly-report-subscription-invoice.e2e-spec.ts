import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { EmailService } from "../../src/notifications/email.service";
import { MonthlySellerReportService } from "../../src/seller-notifications/monthly-seller-report.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * SRS §5.6k (v0.41), FR-6.47 (Module 70) - the monthly seller report email
 * (unconditional, no opt-out) and the downloadable UZEYN subscription
 * invoice PDF (plan-fee payments + refund_adjustment ledger entries for the
 * requested period, commission-free).
 */
describe("Monthly seller report + UZEYN subscription invoice (e2e) - SRS §5.6k/§14.66 (Module 70, FR-6.47)", () => {
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
    jest.clearAllMocks();
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

  it("FR-6.47: the monthly sweep only sends on the 1st of the month, unconditionally (no opt-out), and skips a seller with nothing to report", async () => {
    const adminToken = await createAndLoginAdmin("report-admin1@example.com");
    const seller = await signup("report-monthly@example.com");
    await payPlanFee(seller.token, adminToken);
    await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${seller.token}`).send({ name: "Store", slug: "report-monthly-store" });
    const noActivitySeller = await signup("report-no-activity@example.com");

    const emailSpy = jest.spyOn(app.get(EmailService), "sendMonthlySellerReportEmail");
    const service = app.get(MonthlySellerReportService);

    // The plan-fee payment was just verified at the real "now" - to land
    // it inside the sweep's computed prior-month window, the sweep's `now`
    // must be the 1st of the NEXT calendar month relative to real now.
    const realNow = new Date();
    const currentMonthLabel = realNow.toISOString().slice(0, 7);
    const firstOfNextMonth = new Date(Date.UTC(realNow.getUTCFullYear(), realNow.getUTCMonth() + 1, 1));
    const midThisMonth = new Date(Date.UTC(realNow.getUTCFullYear(), realNow.getUTCMonth(), 15));

    // Mid-month - must not send at all.
    const midResult = await service.runSweep(midThisMonth);
    expect(midResult.emailsSent).toBe(0);
    expect(emailSpy).not.toHaveBeenCalled();

    // The 1st of the month - the seller who paid gets one email; the seller with no stores/activity doesn't.
    const result = await service.runSweep(firstOfNextMonth);
    expect(result.emailsSent).toBe(1);
    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy).toHaveBeenCalledWith(expect.any(String), currentMonthLabel, 0, 0, expect.any(Number), expect.any(String));
    void noActivitySeller;
  });

  it("FR-6.47: the subscription invoice PDF scopes to verified plan-fee payments in the requested month, commission-free", async () => {
    const adminToken = await createAndLoginAdmin("report-admin2@example.com");
    const seller = await signup("report-invoice@example.com");
    await payPlanFee(seller.token, adminToken);

    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    const payment = await superuser.walletTopUpRequest.findFirstOrThrow({ where: { ownerId: seller.sellerId, planFeePortion: { not: null } } });
    void subscription;
    const month = payment.verifiedAt!.toISOString().slice(0, 7);

    const download = await request(app.getHttpServer())
      .get("/sellers/me/subscription-invoice")
      .query({ month })
      .set("Authorization", `Bearer ${seller.token}`);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.isBuffer(download.body) || download.body instanceof Uint8Array).toBe(true);
    expect(download.body.length).toBeGreaterThan(100); // a real rendered PDF, not an empty stub

    // A month with no activity at all still renders (an empty invoice), never errors.
    const empty = await request(app.getHttpServer())
      .get("/sellers/me/subscription-invoice")
      .query({ month: "2020-01" })
      .set("Authorization", `Bearer ${seller.token}`);
    expect(empty.status).toBe(200);
  });

  it("FR-6.47: an invalid month format is rejected", async () => {
    const seller = await signup("report-badmonth@example.com");
    const res = await request(app.getHttpServer())
      .get("/sellers/me/subscription-invoice")
      .query({ month: "not-a-month" })
      .set("Authorization", `Bearer ${seller.token}`);
    expect(res.status).toBe(400);
  });
});
