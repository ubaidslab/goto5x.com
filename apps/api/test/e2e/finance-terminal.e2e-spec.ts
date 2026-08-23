import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedLedgerEntry, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Founder-approved Finance Terminal (own admin nav item): the three
 * genuinely new aggregation reads (refund history/totals, growth-program
 * obligations by program type, commission-by-tier) plus the CSV/PDF export
 * that reuses them. Revenue-by-period is covered by mrr-analytics.e2e-spec.ts
 * (extended in place); the pending-verification queue is already covered by
 * module20/module89's wallet-topup specs - this file covers only what's new.
 */
describe("Finance Terminal (e2e) - founder-approved scope", () => {
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

  async function createAndLoginAdmin(email: string): Promise<{ token: string; adminUserId: string }> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    const adminUser = await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return { token: verify.body.accessToken as string, adminUserId: adminUser.id };
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

  describe("Refund history & totals", () => {
    it("sums refund_adjustment ledger entries platform-wide and lists them with seller attribution", async () => {
      const admin = await createAndLoginAdmin("finance-refund-admin1@example.com");
      const seller = await signup("finance-refund-1@example.com");
      await payPlanFee(seller.token, admin.token);

      const payment = await superuser.walletTopUpRequest.findFirstOrThrow({ where: { ownerId: seller.sellerId, planFeePortion: { not: null } } });
      const expectedRefund = Number((Number(payment.planFeePortion) * 0.5).toFixed(2));

      await request(app.getHttpServer())
        .post(`/admin/sellers/${seller.sellerId}/subscription/cancel`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ reason: "Refund history e2e coverage." });

      const res = await request(app.getHttpServer()).get("/admin/finance/refunds").set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.totalRefunded).toBeCloseTo(expectedRefund, 1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].sellerBusinessName).toBe(`Business for finance-refund-1@example.com`);
      expect(res.body.items[0].amount).toBeCloseTo(expectedRefund, 1); // always reported positive, never the stored-negative magnitude
    });

    it("with no refunds, reports zero totals rather than erroring", async () => {
      const admin = await createAndLoginAdmin("finance-refund-admin2@example.com");
      const res = await request(app.getHttpServer()).get("/admin/finance/refunds").set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.totalRefunded).toBe(0);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe("Growth-program obligations", () => {
    it("groups outstanding (requested/approved/processing) payout requests by the seller's own program participation", async () => {
      const admin = await createAndLoginAdmin("finance-growth-admin1@example.com");
      const student = await signup("finance-growth-student@example.com");

      const apply = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/applications")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ programType: "student_referral" });
      expect(apply.status).toBe(201);
      const approve = await request(app.getHttpServer())
        .post(`/admin/growth-programs/applications/${apply.body.id}/approve`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({});
      expect(approve.status).toBe(201);

      await seedLedgerEntry(superuser, { sellerId: student.sellerId, type: "program_reward_credit", amount: 2000, currency: "PKR" });

      const withdraw = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ amount: 1500 });
      expect(withdraw.status).toBe(201);

      const res = await request(app.getHttpServer())
        .get("/admin/finance/growth-program-obligations")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      const studentBucket = res.body.byProgram.find((b: { programType: string }) => b.programType === "student_referral");
      expect(studentBucket).toBeDefined();
      expect(studentBucket.count).toBe(1);
      expect(studentBucket.outstandingAmount).toBe(1500);
      expect(res.body.totalOutstanding).toBe(1500);
    });

    it("a paid-out withdrawal is no longer outstanding and drops out of the obligations sum", async () => {
      const admin = await createAndLoginAdmin("finance-growth-admin2@example.com");
      const student = await signup("finance-growth-student2@example.com");

      const apply = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/applications")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ programType: "student_referral" });
      await request(app.getHttpServer())
        .post(`/admin/growth-programs/applications/${apply.body.id}/approve`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({});
      await seedLedgerEntry(superuser, { sellerId: student.sellerId, type: "program_reward_credit", amount: 2000, currency: "PKR" });
      const withdraw = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${student.token}`)
        .send({ amount: 1500 });

      await request(app.getHttpServer())
        .post(`/admin/growth-programs/withdrawals/${withdraw.body.id}/approve`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({});
      await request(app.getHttpServer())
        .post(`/admin/growth-programs/withdrawals/${withdraw.body.id}/paid`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ paymentReference: "ref-123" });

      const res = await request(app.getHttpServer())
        .get("/admin/finance/growth-program-obligations")
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.body.totalOutstanding).toBe(0);
      expect(res.body.byProgram).toHaveLength(0);
    });
  });

  describe("Commission status by tier", () => {
    it("returns every individual tier's resolved commission rate alongside the global default", async () => {
      const admin = await createAndLoginAdmin("finance-commission-admin1@example.com");
      const res = await request(app.getHttpServer()).get("/admin/finance/commission-by-tier").set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.globalDefault).toBe("number");
      expect(res.body.tiers.length).toBe(4); // GO/RUN/RISE/FLY
      const names = res.body.tiers.map((t: { tierName: string }) => t.tierName);
      expect(names).toEqual(["GO", "RUN", "RISE", "FLY"]);
      for (const tier of res.body.tiers) {
        expect(typeof tier.commissionPercent).toBe("number");
      }
    });
  });

  describe("Financial export", () => {
    it("GET /admin/finance/export.csv returns a downloadable CSV summary", async () => {
      const admin = await createAndLoginAdmin("finance-export-admin1@example.com");
      const res = await request(app.getHttpServer()).get("/admin/finance/export.csv").set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("MRR");
      expect(res.text).toContain("Total Refunded");
    });

    it("GET /admin/finance/export.pdf returns a downloadable PDF summary", async () => {
      const admin = await createAndLoginAdmin("finance-export-admin2@example.com");
      const res = await request(app.getHttpServer()).get("/admin/finance/export.pdf").set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(Buffer.isBuffer(res.body) ? res.body.length : res.body.byteLength ?? 0).toBeGreaterThan(0);
    });
  });

  it("every admin/finance route requires admin auth", async () => {
    const routes = [
      "/admin/finance/refunds",
      "/admin/finance/growth-program-obligations",
      "/admin/finance/commission-by-tier",
      "/admin/finance/export.csv",
      "/admin/finance/export.pdf",
    ];
    for (const route of routes) {
      const res = await request(app.getHttpServer()).get(route);
      expect(res.status).toBe(401);
    }
  });
});
