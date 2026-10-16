import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * SRS FR-8.17 (Module 89) - bulk-action backend endpoints for moderation and
 * wallet-topup verification, replacing the admin terminal's client-side
 * Promise.all fan-out: one HTTP request per batch, a per-item try/catch so
 * one bad row never blocks the rest, a real {succeeded, failed} shape, and
 * one batch-summary audit-log entry.
 */
describe("Bulk-action backend endpoints (e2e) - SRS FR-8.17 (Module 89)", () => {
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

  async function signupLoginAndCreateStore(email: string, slug: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, storeId: store.body.id as string, sellerId: seller.id as string };
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

  describe("Moderation bulk-decide (POST admin/moderation/queue/bulk-decide)", () => {
    async function createPendingProduct(token: string, storeId: string, title: string) {
      const create = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title, status: "active" });
      expect(create.body.moderationStatus).toBe("pending");
      return create.body.id as string;
    }

    it("approves the mix, reports the already-decided product as a per-item failure, and posts exactly one batch audit entry", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("bulk-mod-seller@example.com", "bulk-mod-store");
      const adminToken = await createAndLoginAdmin("bulk-mod-admin1@example.com");

      const productA = await createPendingProduct(token, storeId, "Bulk Product A");
      const productB = await createPendingProduct(token, storeId, "Bulk Product B");
      const alreadyDecided = await createPendingProduct(token, storeId, "Bulk Product Already Decided");
      await request(app.getHttpServer())
        .post(`/admin/moderation/queue/${alreadyDecided}/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      const bulk = await request(app.getHttpServer())
        .post("/admin/moderation/queue/bulk-decide")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ productIds: [productA, productB, alreadyDecided], decision: "approve" });

      expect(bulk.status).toBe(201);
      expect(bulk.body.succeeded.sort()).toEqual([productA, productB].sort());
      expect(bulk.body.failed).toHaveLength(1);
      expect(bulk.body.failed[0].id).toBe(alreadyDecided);

      const approvedA = await superuser.product.findUniqueOrThrow({ where: { id: productA } });
      expect(approvedA.moderationStatus).toBe("approved");

      const auditLogs = await superuser.adminAuditLog.findMany({ where: { action: "moderation.bulk_approve" } });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].afterValue).toMatchObject({ succeeded: expect.arrayContaining([productA, productB]) });
    });

    it("rejects the whole batch with 400 when no reason is given (reject requires notes, same as the single-item endpoint)", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("bulk-mod-seller2@example.com", "bulk-mod-store2");
      const adminToken = await createAndLoginAdmin("bulk-mod-admin2@example.com");
      const productId = await createPendingProduct(token, storeId, "Bulk Reject No Reason");

      const bulk = await request(app.getHttpServer())
        .post("/admin/moderation/queue/bulk-decide")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ productIds: [productId], decision: "reject" });
      expect(bulk.status).toBe(400);

      const unchanged = await superuser.product.findUniqueOrThrow({ where: { id: productId } });
      expect(unchanged.moderationStatus).toBe("pending");
    });

    it("rejects a batch with a reason, posting one bulk_reject audit entry", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("bulk-mod-seller3@example.com", "bulk-mod-store3");
      const adminToken = await createAndLoginAdmin("bulk-mod-admin3@example.com");
      const productA = await createPendingProduct(token, storeId, "Bulk Reject A");
      const productB = await createPendingProduct(token, storeId, "Bulk Reject B");

      const bulk = await request(app.getHttpServer())
        .post("/admin/moderation/queue/bulk-decide")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ productIds: [productA, productB], decision: "reject", notes: "Prohibited items." });
      expect(bulk.status).toBe(201);
      expect(bulk.body.succeeded.sort()).toEqual([productA, productB].sort());
      expect(bulk.body.failed).toEqual([]);

      const auditLogs = await superuser.adminAuditLog.findMany({ where: { action: "moderation.bulk_reject" } });
      expect(auditLogs).toHaveLength(1);
    });
  });

  describe("Wallet top-up bulk-decide (POST admin/wallet-topups/bulk-decide)", () => {
    async function requestPlanFeeTopUp(email: string, storeSlug: string) {
      const { token, sellerId } = await signupLoginAndCreateStore(email, storeSlug);
      const submit = await request(app.getHttpServer())
        .post("/sellers/me/wallet/plan-fee-payment")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      return { sellerId, topUpId: submit.body.request.id as string };
    }

    it("verifies a mixed batch, reports an unknown id as a per-item failure, and posts exactly one bulk_verified audit entry", async () => {
      // D116 item 2 - bulkDecide() is now step-up-MFA-gated (StepUpMfaGuard),
      // same requirement as verify()/reject() (it dispatches to the exact
      // same WalletService methods, so leaving it unguarded would make the
      // per-item guard trivially bypassable). This file's shared
      // createAndLoginAdmin() doesn't expose the enrolled secret and the
      // moderation bulk-decide tests above never call this route at all, so
      // a fresh enroll+verify flow is done inline here rather than widening
      // that shared helper's return shape for every one of its other callers.
      const bcrypt = await import("bcryptjs");
      const adminEmail = "bulk-wallet-admin1@example.com";
      const adminUser = await superuser.user.create({
        data: { email: adminEmail, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), roleFlags: ["admin"], emailVerifiedAt: new Date() },
      });
      await superuser.adminUser.create({ data: { userId: adminUser.id, role: "super_admin", mfaEnabled: false } });
      const adminLogin = await request(app.getHttpServer()).post("/admin/auth/login").send({ email: adminEmail, password: ADMIN_PASSWORD });
      const adminEnroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: adminLogin.body.preAuthToken });
      const { authenticator } = await import("otplib");
      const mfaSecret = adminEnroll.body.secret as string;
      const adminVerify = await request(app.getHttpServer())
        .post("/admin/auth/mfa/verify")
        .send({ preAuthToken: adminLogin.body.preAuthToken, code: authenticator.generate(mfaSecret) });
      const adminToken = adminVerify.body.accessToken as string;
      const first = await requestPlanFeeTopUp("bulk-wallet-seller1@example.com", "bulk-wallet-store1");
      const second = await requestPlanFeeTopUp("bulk-wallet-seller2@example.com", "bulk-wallet-store2");
      const unknownId = "2bdf7bce-5e70-4efb-8b34-0e93eab09ef8"; // syntactically valid v4 UUID, not a real row

      const bulk = await request(app.getHttpServer())
        .post("/admin/wallet-topups/bulk-decide")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Step-Up-MFA-Code", authenticator.generate(mfaSecret))
        .send({ topUpIds: [first.topUpId, second.topUpId, unknownId], decision: "verify" });

      expect(bulk.status).toBe(201);
      expect(bulk.body.succeeded.sort()).toEqual([first.topUpId, second.topUpId].sort());
      expect(bulk.body.failed).toHaveLength(1);
      expect(bulk.body.failed[0].id).toBe(unknownId);

      const verifiedFirst = await superuser.walletTopUpRequest.findUniqueOrThrow({ where: { id: first.topUpId } });
      expect(verifiedFirst.status).toBe("verified");
      const verifiedSecond = await superuser.walletTopUpRequest.findUniqueOrThrow({ where: { id: second.topUpId } });
      expect(verifiedSecond.status).toBe("verified");

      const auditLogs = await superuser.adminAuditLog.findMany({ where: { action: "billing.wallet_topups_bulk_verified" } });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].afterValue).toMatchObject({ succeeded: expect.arrayContaining([first.topUpId, second.topUpId]) });
    });

    it("rejects a batch of pending top-ups, posting one bulk_rejected audit entry", async () => {
      // D116 item 2 - inline enroll+verify flow, same reason as the test above.
      const bcrypt = await import("bcryptjs");
      const adminEmail = "bulk-wallet-admin2@example.com";
      const adminUser = await superuser.user.create({
        data: { email: adminEmail, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), roleFlags: ["admin"], emailVerifiedAt: new Date() },
      });
      await superuser.adminUser.create({ data: { userId: adminUser.id, role: "super_admin", mfaEnabled: false } });
      const adminLogin = await request(app.getHttpServer()).post("/admin/auth/login").send({ email: adminEmail, password: ADMIN_PASSWORD });
      const adminEnroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: adminLogin.body.preAuthToken });
      const { authenticator } = await import("otplib");
      const mfaSecret = adminEnroll.body.secret as string;
      const adminVerify = await request(app.getHttpServer())
        .post("/admin/auth/mfa/verify")
        .send({ preAuthToken: adminLogin.body.preAuthToken, code: authenticator.generate(mfaSecret) });
      const adminToken = adminVerify.body.accessToken as string;
      const first = await requestPlanFeeTopUp("bulk-wallet-seller3@example.com", "bulk-wallet-store3");
      const second = await requestPlanFeeTopUp("bulk-wallet-seller4@example.com", "bulk-wallet-store4");

      const bulk = await request(app.getHttpServer())
        .post("/admin/wallet-topups/bulk-decide")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Step-Up-MFA-Code", authenticator.generate(mfaSecret))
        .send({ topUpIds: [first.topUpId, second.topUpId], decision: "reject" });

      expect(bulk.status).toBe(201);
      expect(bulk.body.succeeded.sort()).toEqual([first.topUpId, second.topUpId].sort());
      expect(bulk.body.failed).toEqual([]);

      const rejectedFirst = await superuser.walletTopUpRequest.findUniqueOrThrow({ where: { id: first.topUpId } });
      expect(rejectedFirst.status).toBe("rejected");

      const auditLogs = await superuser.adminAuditLog.findMany({ where: { action: "billing.wallet_topups_bulk_rejected" } });
      expect(auditLogs).toHaveLength(1);
    });

    it("verifying the same top-up twice in one batch fails the second occurrence (no double-verify), and never double-audits the underlying WalletService entry", async () => {
      // D116 item 2 - inline enroll+verify flow, same reason as the tests above.
      const bcrypt = await import("bcryptjs");
      const adminEmail = "bulk-wallet-admin3@example.com";
      const adminUser = await superuser.user.create({
        data: { email: adminEmail, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), roleFlags: ["admin"], emailVerifiedAt: new Date() },
      });
      await superuser.adminUser.create({ data: { userId: adminUser.id, role: "super_admin", mfaEnabled: false } });
      const adminLogin = await request(app.getHttpServer()).post("/admin/auth/login").send({ email: adminEmail, password: ADMIN_PASSWORD });
      const adminEnroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: adminLogin.body.preAuthToken });
      const { authenticator } = await import("otplib");
      const mfaSecret = adminEnroll.body.secret as string;
      const adminVerify = await request(app.getHttpServer())
        .post("/admin/auth/mfa/verify")
        .send({ preAuthToken: adminLogin.body.preAuthToken, code: authenticator.generate(mfaSecret) });
      const adminToken = adminVerify.body.accessToken as string;
      const only = await requestPlanFeeTopUp("bulk-wallet-seller5@example.com", "bulk-wallet-store5");

      const bulk = await request(app.getHttpServer())
        .post("/admin/wallet-topups/bulk-decide")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Step-Up-MFA-Code", authenticator.generate(mfaSecret))
        .send({ topUpIds: [only.topUpId, only.topUpId], decision: "verify" });

      expect(bulk.status).toBe(201);
      expect(bulk.body.succeeded).toEqual([only.topUpId]);
      expect(bulk.body.failed).toHaveLength(1);
      expect(bulk.body.failed[0].id).toBe(only.topUpId);
    });
  });
});
