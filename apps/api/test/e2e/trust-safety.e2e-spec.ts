import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";
import * as bcrypt from "bcryptjs";
import request from "supertest";
import { RiskScoreService } from "../../src/trust-safety/risk-score.service";
import { SellerAgreementService } from "../../src/trust-safety/seller-agreement.service";
import { TrustSafetyMonitorsService } from "../../src/trust-safety/trust-safety-monitors.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

// A second Luhn-valid 13-digit CNIC, distinct from the one used elsewhere
// in this file, for the reuse/conflict tests.
const VALID_CNIC_A = "3541234567899";
const VALID_CNIC_B = "4123456789012";

describe("Trust & Safety System (e2e) - SRS §5.29/§5.30, §14.29/§14.30", () => {
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

  async function signup(email: string, ip?: string, deviceFingerprint?: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .set(ip ? { "X-Forwarded-For": ip } : {})
      .send({
        agreementAccepted: true,
        email,
        password: "correct-horse-battery",
        businessName: `Business for ${email}`,
        deviceFingerprint,
      });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    const token = login.body.accessToken as string;
    const seller = await superuser.seller.findUniqueOrThrow({
      where: { userId: (await superuser.user.findUniqueOrThrow({ where: { email } })).id },
    });
    return { token, sellerId: seller.id };
  }

  async function fullyVerifiedAdminToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash("admin-password", 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });

    const login = await request(app.getHttpServer())
      .post("/admin/auth/login")
      .send({ email, password: "admin-password" });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken;
  }

  describe("Seller Agreement acceptance (FR-29.1/29.2)", () => {
    it("rejects signup without accepting the current agreement version", async () => {
      const res = await request(app.getHttpServer()).post("/auth/signup").send({
        email: "no-agreement@example.com",
        password: "correct-horse-battery",
        businessName: "No Agreement Co",
        agreementAccepted: false,
      });
      expect(res.status).toBe(400);
      const user = await superuser.user.findUnique({ where: { email: "no-agreement@example.com" } });
      expect(user).toBeNull();
    });

    it("records the accepted version, timestamp, and IP at signup", async () => {
      const { sellerId } = await signup("agreement-accept@example.com");
      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
      expect(seller.agreementAcceptedVersion).toBe("1.0");
      expect(seller.agreementAcceptedAt).not.toBeNull();
      expect(seller.agreementAcceptedIp).not.toBeNull();
    });

    it("a version bump requires re-acceptance before the seller-profile endpoint succeeds again", async () => {
      const { token } = await signup("agreement-reaccept@example.com");

      const beforeBump = await request(app.getHttpServer()).get("/sellers/me").set("Authorization", `Bearer ${token}`);
      expect(beforeBump.status).toBe(200);

      const agreements = app.get(SellerAgreementService);
      await agreements.publishNewVersion("1.1");

      const afterBump = await request(app.getHttpServer()).get("/sellers/me").set("Authorization", `Bearer ${token}`);
      expect(afterBump.status).toBe(403);

      await request(app.getHttpServer()).post("/sellers/me/agreement/accept").set("Authorization", `Bearer ${token}`);

      const afterReaccept = await request(app.getHttpServer())
        .get("/sellers/me")
        .set("Authorization", `Bearer ${token}`);
      expect(afterReaccept.status).toBe(200);
    });
  });

  describe("CNIC at seller activation (FR-30.1)", () => {
    it("rejects a malformed CNIC before it is ever stored", async () => {
      const { token, sellerId } = await signup("cnic-bad@example.com");
      const res = await request(app.getHttpServer())
        .patch("/sellers/me/cnic")
        .set("Authorization", `Bearer ${token}`)
        .send({ cnic: "12345" });
      expect(res.status).toBe(400);
      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
      expect(seller.cnicHash).toBeNull();
    });

    it("is encrypted at rest and only ever returned as a last-4 masked view", async () => {
      const { token, sellerId } = await signup("cnic-mask@example.com");
      const set = await request(app.getHttpServer())
        .patch("/sellers/me/cnic")
        .set("Authorization", `Bearer ${token}`)
        .send({ cnic: VALID_CNIC_A });
      expect(set.status).toBe(200);
      expect(set.body.cnicMasked).toBe("•••••••••7899");

      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
      expect(seller.cnicEncrypted).not.toBeNull();
      expect(seller.cnicEncrypted).not.toContain(VALID_CNIC_A);

      const profile = await request(app.getHttpServer()).get("/sellers/me").set("Authorization", `Bearer ${token}`);
      expect(profile.body.cnicMasked).toBe("•••••••••7899");
    });

    it("a CNIC already on file for any seller - regardless of lifecycle status - cannot be reused", async () => {
      const a = await signup("cnic-dupA@example.com");
      await request(app.getHttpServer())
        .patch("/sellers/me/cnic")
        .set("Authorization", `Bearer ${a.token}`)
        .send({ cnic: VALID_CNIC_A });
      await superuser.seller.update({ where: { id: a.sellerId }, data: { lifecycleStatus: "banned" } });

      const b = await signup("cnic-dupB@example.com");
      const dup = await request(app.getHttpServer())
        .patch("/sellers/me/cnic")
        .set("Authorization", `Bearer ${b.token}`)
        .send({ cnic: VALID_CNIC_A });
      expect(dup.status).toBe(409);
    });
  });

  describe("Payment-instrument name-consistency (FR-30.2) and account uniqueness (FR-30.3)", () => {
    async function createStore(token: string, slug: string) {
      const store = await request(app.getHttpServer())
        .post("/stores")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: `Store ${slug}`, slug });
      return store.body.id as string;
    }

    it("rejects saving a payment instrument without a declared title and ownership checkbox", async () => {
      const { token } = await signup("instrument-notitle@example.com");
      const storeId = await createStore(token, "instrument-notitle-store");
      const res = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ jazzcashNumber: "03001234567" });
      expect(res.status).toBe(400);
    });

    it("a clearly matching declared title saves without a flag; a clearly mismatched one queues for review without blocking the dashboard", async () => {
      // businessName defaults to `Business for ${email}` in this file's
      // signup() helper, which never matches a hand-picked title - so this
      // test signs up directly to control businessName precisely.
      await request(app.getHttpServer()).post("/auth/signup").send({
        agreementAccepted: true,
        email: "name-match@example.com",
        password: "correct-horse-battery",
        businessName: "Zainab Textiles",
      });
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "name-match@example.com", password: "correct-horse-battery" });
      const matchToken = login.body.accessToken as string;
      const matchStoreId = await createStore(matchToken, "name-match-store");

      const matching = await request(app.getHttpServer())
        .patch(`/stores/${matchStoreId}/payment-instructions`)
        .set("Authorization", `Bearer ${matchToken}`)
        .send({ jazzcashNumber: "03001111111", jazzcashAccountTitle: "Zainab Textiles", nameDeclaredSelfOwned: true });
      expect(matching.status).toBe(200);
      expect(matching.body.nameConsistencyStatus).toBe("approved");

      // Module 14 (FR-23.5/FR-7.3) - the Free Plan is now really limited to
      // one store per identity; this test creates a second store for the
      // same (CNIC-less) seller purely to exercise name-consistency across
      // two stores, so the per-identity limit is raised for this test only
      // (SettingsService.setValue, not a raw DB write, so the cache the
      // first store's creation already populated is actually invalidated).
      await app
        .get(SettingsService)
        .setValue("plans.free_store_limit_per_identity", "global", null, 10, "00000000-0000-0000-0000-000000000000");
      const mismatchStoreId = await createStore(matchToken, "name-mismatch-store");
      const mismatching = await request(app.getHttpServer())
        .patch(`/stores/${mismatchStoreId}/payment-instructions`)
        .set("Authorization", `Bearer ${matchToken}`)
        .send({ jazzcashNumber: "03002222222", jazzcashAccountTitle: "Totally Different Name", nameDeclaredSelfOwned: true });
      expect(mismatching.status).toBe(200);
      expect(mismatching.body.nameConsistencyStatus).toBe("pending");

      // Not blocked from continuing to use the dashboard otherwise.
      const stillWorks = await request(app.getHttpServer())
        .get(`/stores/${mismatchStoreId}/payment-instructions`)
        .set("Authorization", `Bearer ${matchToken}`);
      expect(stillWorks.status).toBe(200);
    });

    it("a second seller cannot claim a bank/JazzCash/Easypaisa number already registered to another seller", async () => {
      const a = await signup("fingerprint-a@example.com");
      const aStoreId = await createStore(a.token, "fingerprint-a-store");
      await request(app.getHttpServer())
        .patch(`/stores/${aStoreId}/payment-instructions`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ jazzcashNumber: "03009999999", jazzcashAccountTitle: "Whatever Title", nameDeclaredSelfOwned: true });

      const b = await signup("fingerprint-b@example.com");
      const bStoreId = await createStore(b.token, "fingerprint-b-store");
      const conflict = await request(app.getHttpServer())
        .patch(`/stores/${bStoreId}/payment-instructions`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ jazzcashNumber: "03009999999", jazzcashAccountTitle: "Another Title", nameDeclaredSelfOwned: true });
      expect(conflict.status).toBe(400);
    });
  });

  describe("Risk score (FR-30.5) and re-registration check (FR-30.6)", () => {
    it("a clean signup (verified email, valid CNIC, no flags) resolves to auto_approved", async () => {
      const { token, sellerId } = await signup("risk-clean@example.com");
      await request(app.getHttpServer())
        .patch("/sellers/me/cnic")
        .set("Authorization", `Bearer ${token}`)
        .send({ cnic: VALID_CNIC_A });
      await superuser.user.update({
        where: { id: (await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } })).userId },
        data: { emailVerifiedAt: new Date() },
      });
      const riskScore = app.get(RiskScoreService);
      await riskScore.recompute(sellerId);
      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
      expect(seller.activationStatus).toBe("auto_approved");
    });

    it("a partial combination (email unverified, no CNIC) resolves to manual review, not block", async () => {
      const { sellerId } = await signup("risk-partial@example.com");
      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
      // Default weights: email_unverified(20) + cnic_missing(30) = 50, which
      // is >= the manual_review threshold (30) but < the block threshold (60).
      expect(seller.activationStatus).toBe("pending_review");
    });

    it("a high-risk combination (unverified email, no CNIC, mismatched name, account reuse) resolves to block", async () => {
      const { token, sellerId } = await signup("risk-high@example.com");
      const storeId = (
        await request(app.getHttpServer())
          .post("/stores")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: "Risk High Store", slug: "risk-high-store" })
      ).body.id;
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ jazzcashNumber: "03005555555", jazzcashAccountTitle: "Completely Unrelated Name", nameDeclaredSelfOwned: true });

      const riskScore = app.get(RiskScoreService);
      await riskScore.recompute(sellerId);
      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
      // unverified email(20) + missing CNIC(30) + name mismatch(25) = 75 >= block threshold (60).
      expect(seller.riskScore).toBeGreaterThanOrEqual(60);
      expect(seller.activationStatus).toBe("blocked");
    });

    it("a device fingerprint/IP match alone (every other input clean) never resolves to block by itself", async () => {
      const a = await signup("risk-device-a@example.com", "1.2.3.4", "fingerprint-shared");
      await request(app.getHttpServer())
        .patch("/sellers/me/cnic")
        .set("Authorization", `Bearer ${a.token}`)
        .send({ cnic: VALID_CNIC_A });
      await superuser.user.update({
        where: { id: (await superuser.seller.findUniqueOrThrow({ where: { id: a.sellerId } })).userId },
        data: { emailVerifiedAt: new Date() },
      });

      const b = await signup("risk-device-b@example.com", "1.2.3.4", "fingerprint-shared");
      await request(app.getHttpServer())
        .patch("/sellers/me/cnic")
        .set("Authorization", `Bearer ${b.token}`)
        .send({ cnic: VALID_CNIC_B });
      await superuser.user.update({
        where: { id: (await superuser.seller.findUniqueOrThrow({ where: { id: b.sellerId } })).userId },
        data: { emailVerifiedAt: new Date() },
      });

      const riskScore = app.get(RiskScoreService);
      await riskScore.recompute(b.sellerId);
      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: b.sellerId } });
      expect(seller.activationStatus).not.toBe("blocked");
    });

    it("re-registration with a device/IP cluster matching a currently-suspended seller is flagged and blocked, not silently allowed", async () => {
      const suspended = await signup("risk-suspended@example.com", "9.9.9.9", "evader-fingerprint");
      await superuser.seller.update({ where: { id: suspended.sellerId }, data: { lifecycleStatus: "suspended" } });

      const evader = await signup("risk-evader@example.com", "9.9.9.9", "evader-fingerprint");
      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: evader.sellerId } });
      expect(seller.activationStatus).toBe("blocked");
    });
  });

  describe("T&S enforcement ladder (FR-29.4) and audit logging", () => {
    it("every lifecycle action is captured in admin_audit_logs with actor, target, and reason", async () => {
      const { sellerId } = await signup("ladder-target@example.com");
      const adminToken = await fullyVerifiedAdminToken("ladder-admin@example.com");

      const res = await request(app.getHttpServer())
        .post(`/admin/sellers/${sellerId}/lifecycle`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "warned", reason: "Suspicious listing pattern" });
      expect(res.status).toBe(201);

      const logs = await superuser.adminAuditLog.findMany({ where: { targetId: sellerId, action: "seller.lifecycle.set_status" } });
      expect(logs).toHaveLength(1);
      expect(logs[0].afterValue).toMatchObject({ lifecycleStatus: "warned", reason: "Suspicious listing pattern" });

      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
      expect(seller.lifecycleStatus).toBe("warned");
    });

    it("no flag auto-escalates a seller's lifecycle state without an explicit admin action", async () => {
      const { sellerId } = await signup("no-auto-escalate@example.com");
      // Deliberately construct a flag-worthy condition (missing CNIC, unverified email).
      const riskScore = app.get(RiskScoreService);
      await riskScore.recompute(sellerId);
      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
      expect(seller.activationStatus).not.toBe("auto_approved"); // the flag fired...
      expect(seller.lifecycleStatus).toBe("active"); // ...but the LIFECYCLE ladder never moved on its own.
    });
  });

  describe("Anti-underreporting monitors (FR-6.19) and bypass-attempt detection (FR-29.3)", () => {
    it("flags a seller over the cancellation-rate threshold and does not flag one under it", async () => {
      const over = await signup("cancel-over@example.com");
      const overStoreId = (
        await request(app.getHttpServer())
          .post("/stores")
          .set("Authorization", `Bearer ${over.token}`)
          .send({ name: "Cancel Over Store", slug: "cancel-over-store" })
      ).body.id;
      // 5 orders, 4 cancelled = 80% (min sample 5, threshold 30%).
      for (let i = 0; i < 5; i++) {
        const order = await superuser.order.create({
          data: {
            storeId: overStoreId,
            buyerEmail: "buyer@example.com",
            statusLookupToken: `token-cancel-${i}`,
            shippingAddress: {},
            shippingAmount: 0,
            totalAmount: 100,
            currency: "PKR",
            status: i < 4 ? "cancelled" : "confirmed",
          },
        });
        void order;
      }

      const under = await signup("cancel-under@example.com");
      const underStoreId = (
        await request(app.getHttpServer())
          .post("/stores")
          .set("Authorization", `Bearer ${under.token}`)
          .send({ name: "Cancel Under Store", slug: "cancel-under-store" })
      ).body.id;
      for (let i = 0; i < 5; i++) {
        await superuser.order.create({
          data: {
            storeId: underStoreId,
            buyerEmail: "buyer@example.com",
            statusLookupToken: `token-clean-${i}`,
            shippingAddress: {},
            shippingAmount: 0,
            totalAmount: 100,
            currency: "PKR",
            status: "confirmed",
          },
        });
      }

      const monitors = app.get(TrustSafetyMonitorsService);
      const flags = await monitors.cancellationRateFlags();
      expect(flags.some((f) => f.sellerId === over.sellerId)).toBe(true);
      expect(flags.some((f) => f.sellerId === under.sellerId)).toBe(false);
    });

    it("flags a seller over the pending-forever-rate threshold and does not flag one under it", async () => {
      const over = await signup("pending-over@example.com");
      const overStoreId = (
        await request(app.getHttpServer())
          .post("/stores")
          .set("Authorization", `Bearer ${over.token}`)
          .send({ name: "Pending Over Store", slug: "pending-over-store" })
      ).body.id;
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days old, past the 14-day max
      for (let i = 0; i < 5; i++) {
        await superuser.order.create({
          data: {
            storeId: overStoreId,
            buyerEmail: "buyer@example.com",
            statusLookupToken: `token-pending-${i}`,
            shippingAddress: {},
            shippingAmount: 0,
            totalAmount: 100,
            currency: "PKR",
            status: "pending",
            placedAt: oldDate,
          },
        });
      }

      const monitors = app.get(TrustSafetyMonitorsService);
      const flags = await monitors.pendingForeverRateFlags();
      expect(flags.some((f) => f.sellerId === over.sellerId)).toBe(true);
    });

    it("detects a repeated banned-keyword-blocked pattern as a signal distinct from a single blocked listing", async () => {
      const { token } = await signup("bypass-attempt@example.com");
      const storeId = (
        await request(app.getHttpServer())
          .post("/stores")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: "Bypass Store", slug: "bypass-store" })
      ).body.id;
      await superuser.settingsValue.create({
        data: { definitionKey: "moderation.banned_keywords", scopeType: "global", scopeId: null, value: ["contraband"] },
      });
      const category = await superuser.category.create({ data: { name: "Bypass Cat", slug: "bypass-cat" } });

      // A single blocked attempt.
      const single = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Contraband Item", categoryId: category.id, status: "active" });
      expect(single.status).toBe(400);

      const monitors = app.get(TrustSafetyMonitorsService);
      const afterOne = await monitors.bypassAttemptFlags();
      expect(afterOne.some((f) => f.sellerId)).toBe(false); // one alone doesn't cross the threshold (default 3)

      // Two more attempts - now over the threshold.
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Contraband Item 2", categoryId: category.id, status: "active" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Contraband Item 3", categoryId: category.id, status: "active" });

      const afterThree = await monitors.bypassAttemptFlags();
      expect(afterThree.length).toBeGreaterThan(0);
    });
  });

  describe("Payment-instrument review queue admin API (FR-30.2)", () => {
    it("an admin can approve or reject a queued name-consistency mismatch", async () => {
      await request(app.getHttpServer()).post("/auth/signup").send({
        agreementAccepted: true,
        email: "review-queue@example.com",
        password: "correct-horse-battery",
        businessName: "Review Queue Legit Name",
      });
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "review-queue@example.com", password: "correct-horse-battery" });
      const token = login.body.accessToken as string;
      const storeId = (
        await request(app.getHttpServer())
          .post("/stores")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: "Review Queue Store", slug: "review-queue-store" })
      ).body.id;
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ jazzcashNumber: "03007777777", jazzcashAccountTitle: "Nothing Alike", nameDeclaredSelfOwned: true });

      const adminToken = await fullyVerifiedAdminToken("review-admin@example.com");
      const queue = await request(app.getHttpServer())
        .get("/admin/trust-safety/payment-review/queue")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(queue.body.some((i: { storeId: string }) => i.storeId === storeId)).toBe(true);

      const approve = await request(app.getHttpServer())
        .post(`/admin/trust-safety/payment-review/${storeId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(approve.status).toBe(201);
      expect(approve.body.nameConsistencyStatus).toBe("approved");

      const log = await superuser.adminAuditLog.findFirst({ where: { targetId: storeId, action: "payment_instrument_review.approve" } });
      expect(log).not.toBeNull();
    });
  });
});
