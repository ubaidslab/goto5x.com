import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { StoreHealthScoreService } from "../../src/store-health/store-health-score.service";
import { VerificationReReviewService } from "../../src/verification/verification-re-review.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Module 23 (SRS §5.34 Store Health Score, §5.35 Verified Store Program,
 * checklists §14.34/§14.35).
 */
describe("Store Health Score + Verified Store Program (e2e) - SRS §5.34/§5.35", () => {
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

  async function createStore(email: string, slug: string) {
    const { token, sellerId } = await signup(email);
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    return { token, storeId: store.body.id as string, sellerId };
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

  async function topUpAndVerify(token: string, adminToken: string, amount: number) {
    const req = await request(app.getHttpServer()).post("/sellers/me/wallet/topup-requests").set("Authorization", `Bearer ${token}`).send({ amount });
    await request(app.getHttpServer()).post(`/admin/wallet-topups/${req.body.request.id}/verify`).set("Authorization", `Bearer ${adminToken}`);
  }

  /** Forces every eligibility criterion to pass directly via the DB, so tests can isolate one criterion at a time. */
  async function makeFullyEligible(storeId: string, sellerId: string) {
    await superuser.storeHealthScoreHistory.create({ data: { storeId, score: 100, breakdown: [] } });
    await superuser.seller.update({ where: { id: sellerId }, data: { cnicEncrypted: "encrypted-cnic", cnicHash: `hash-${sellerId}` } });
    const domain = await superuser.domain.create({
      data: {
        storeId,
        domainName: `verified-${storeId}-${Date.now()}-${Math.random().toString(36).slice(2)}.example.com`,
        verificationStatus: "verified",
        verifiedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      },
    });
    const settings = app.get(SettingsService);
    await settings.setValue("verification.min_confirmed_sales", "global", null, 0, ADMIN_ID);
    return domain;
  }

  describe("Store Health Score (FR-34.1-34.3)", () => {
    it("weights are Settings-Registry-driven - changing one changes the next computed score", async () => {
      const { storeId } = await createStore("health-weights@example.com", "health-weights");
      const order = await superuser.order.create({
        data: {
          storeId,
          buyerEmail: "buyer@example.com",
          statusLookupToken: `tok-${storeId}-1`,
          shippingAddress: {},
          status: "shipped",
          shippingAmount: 0,
          totalAmount: 100,
          currency: "PKR",
          placedAt: new Date(),
        },
      });
      const confirmedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const shippedAt = new Date(); // 10 days later - well past the 3-day default target, so fulfillment scores poorly
      await superuser.orderTimelineEvent.create({ data: { storeId, orderId: order.id, eventType: "status_changed", afterValue: { status: "confirmed" }, createdAt: confirmedAt } });
      await superuser.orderTimelineEvent.create({ data: { storeId, orderId: order.id, eventType: "status_changed", afterValue: { status: "shipped" }, createdAt: shippedAt } });

      const healthService = app.get(StoreHealthScoreService);
      const before = await healthService.computeForStore(storeId);
      const fulfillmentBefore = before.breakdown.find((i) => i.key === "fulfillment")!;
      expect(fulfillmentBefore.fraction).toBe(0); // 0 of 1 shipped on time

      const settings = app.get(SettingsService);
      await settings.setValue("storehealth.weight_fulfillment", "global", null, 0, ADMIN_ID);

      const after = await healthService.computeForStore(storeId);
      // Zeroing out the poorly-performing input's weight can only raise (never lower) the normalized score.
      expect(after.score).toBeGreaterThan(before.score);
    });

    it("profile completeness scores partial credit, not zero, as inputs are added one at a time", async () => {
      const { storeId } = await createStore("health-profile@example.com", "health-profile");
      const healthService = app.get(StoreHealthScoreService);

      const empty = await healthService.computeForStore(storeId);
      const completenessEmpty = empty.breakdown.find((i) => i.key === "profile_completeness")!;
      expect(completenessEmpty.fraction).toBe(0);

      await superuser.store.update({ where: { id: storeId }, data: { policyText: "We ship within 2 days." } });
      const withPolicy = await healthService.computeForStore(storeId);
      const completenessWithPolicy = withPolicy.breakdown.find((i) => i.key === "profile_completeness")!;
      expect(completenessWithPolicy.fraction).toBeCloseTo(0.25, 5);
      expect(completenessWithPolicy.fraction).toBeGreaterThan(completenessEmpty.fraction);
    });

    it("the recompute is idempotent and keeps one history row per run; the dashboard renders that history", async () => {
      const { token, storeId } = await createStore("health-history@example.com", "health-history");
      const healthService = app.get(StoreHealthScoreService);

      await healthService.recomputeAndRecord(storeId);
      await healthService.recomputeAndRecord(storeId);

      const history = await request(app.getHttpServer()).get(`/stores/${storeId}/health/history`).set("Authorization", `Bearer ${token}`);
      expect(history.status).toBe(200);
      expect(history.body).toHaveLength(2);

      const current = await request(app.getHttpServer()).get(`/stores/${storeId}/health`).set("Authorization", `Bearer ${token}`);
      expect(current.status).toBe(200);
      expect(current.body.score).toBe(history.body[0].score);
    });

    it("the breakdown names the specific input dragging the score down with a plain-language suggestion", async () => {
      const { storeId } = await createStore("health-suggestion@example.com", "health-suggestion");
      await superuser.order.create({
        data: {
          storeId,
          buyerEmail: "buyer@example.com",
          statusLookupToken: `tok-${storeId}-stale`,
          shippingAddress: {},
          status: "pending",
          shippingAmount: 0,
          totalAmount: 100,
          currency: "PKR",
          placedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        },
      });

      const healthService = app.get(StoreHealthScoreService);
      const result = await healthService.computeForStore(storeId);
      const pendingForever = result.breakdown.find((i) => i.key === "pending_forever")!;
      expect(pendingForever.suggestion).toMatch(/pending/i);
      // Every other suggestion, when present, must also be a real sentence, never raw weighted-sum math.
      for (const input of result.breakdown) {
        if (input.suggestion) expect(input.suggestion).not.toMatch(/\d+\s*\*\s*\d+/);
      }
    });
  });

  describe("Verified Store Program (FR-35.1-35.6)", () => {
    it("the eligibility portal evaluates all criteria live - lowering a threshold changes the result", async () => {
      const { token, storeId, sellerId } = await createStore("verif-eligibility@example.com", "verif-eligibility");
      await superuser.storeHealthScoreHistory.create({ data: { storeId, score: 90, breakdown: [] } });
      await superuser.seller.update({ where: { id: sellerId }, data: { cnicEncrypted: "x", cnicHash: `hash-${sellerId}` } });
      await superuser.domain.create({
        data: { storeId, domainName: `elig-${storeId}.example.com`, verificationStatus: "verified", verifiedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) },
      });
      // Zero confirmed sales - fails the min-sales criterion only.

      const before = await request(app.getHttpServer()).get(`/stores/${storeId}/verification/eligibility`).set("Authorization", `Bearer ${token}`);
      expect(before.status).toBe(200);
      expect(before.body.allPass).toBe(false);
      const salesBefore = before.body.criteria.find((c: { key: string }) => c.key === "min_confirmed_sales");
      expect(salesBefore.pass).toBe(false);

      const settings = app.get(SettingsService);
      await settings.setValue("verification.min_confirmed_sales", "global", null, 0, ADMIN_ID);

      const after = await request(app.getHttpServer()).get(`/stores/${storeId}/verification/eligibility`).set("Authorization", `Bearer ${token}`);
      expect(after.body.allPass).toBe(true);
    });

    it("attaching a different custom domain resets the 6+ month continuous-tenure clock", async () => {
      const { token, storeId } = await createStore("verif-domain-swap@example.com", "verif-domain-swap");
      await superuser.domain.create({
        data: { storeId, domainName: `old-${storeId}.example.com`, verificationStatus: "verified", verifiedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) },
      });

      const before = await request(app.getHttpServer()).get(`/stores/${storeId}/verification/eligibility`).set("Authorization", `Bearer ${token}`);
      const tenureBefore = before.body.criteria.find((c: { key: string }) => c.key === "tenure");
      expect(tenureBefore.pass).toBe(true);

      // A different domain is attached - a brand new row, freshly verified.
      await superuser.domain.create({
        data: { storeId, domainName: `new-${storeId}.example.com`, verificationStatus: "verified", verifiedAt: new Date() },
      });

      const after = await request(app.getHttpServer()).get(`/stores/${storeId}/verification/eligibility`).set("Authorization", `Bearer ${token}`);
      const tenureAfter = after.body.criteria.find((c: { key: string }) => c.key === "tenure");
      expect(tenureAfter.pass).toBe(false);
    });

    it("the verification fee debits the wallet at application time, before any admin decision exists", async () => {
      const { token, storeId, sellerId } = await createStore("verif-fee@example.com", "verif-fee");
      const { token: adminToken } = await createAndLoginAdmin("verif-fee-admin@example.com");
      await makeFullyEligible(storeId, sellerId);
      await topUpAndVerify(token, adminToken, 5000);

      const apply = await request(app.getHttpServer()).post(`/stores/${storeId}/verification/apply`).set("Authorization", `Bearer ${token}`);
      expect(apply.status).toBe(201);
      expect(apply.body.status).toBe("pending_review");
      expect(apply.body.decidedAt).toBeNull();

      const debit = await superuser.ledgerEntry.findFirst({ where: { sellerId, type: "verification_fee_debit" } });
      expect(debit).not.toBeNull();
      expect(Number(debit!.amount)).toBe(5000);
    });

    it("the eligibility gate cannot be bypassed via a direct API call, even when the client-side portal is skipped", async () => {
      const { token, storeId, sellerId } = await createStore("verif-bypass@example.com", "verif-bypass");
      // Deliberately leave CNIC unset and health score absent - fails multiple criteria.
      void sellerId;

      const apply = await request(app.getHttpServer()).post(`/stores/${storeId}/verification/apply`).set("Authorization", `Bearer ${token}`);
      expect(apply.status).toBe(400);

      const applications = await superuser.verifiedStoreApplication.findMany({ where: { storeId } });
      expect(applications).toHaveLength(0);
    });

    it("an application that passes every automated criterion can still be rejected, and rejection refunds the fee in full", async () => {
      const { token, storeId, sellerId } = await createStore("verif-reject@example.com", "verif-reject");
      const { token: adminToken, adminUserId } = await createAndLoginAdmin("verif-reject-admin@example.com");
      await makeFullyEligible(storeId, sellerId);
      await topUpAndVerify(token, adminToken, 5000);

      const apply = await request(app.getHttpServer()).post(`/stores/${storeId}/verification/apply`).set("Authorization", `Bearer ${token}`);
      const reject = await request(app.getHttpServer())
        .post(`/admin/verification/applications/${apply.body.id}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: "Documented pattern of borderline behavior not caught by automated checks." });
      expect(reject.status).toBe(201);
      expect(reject.body.status).toBe("rejected");

      const refund = await superuser.ledgerEntry.findFirst({ where: { sellerId, type: "verification_fee_refund_credit" } });
      expect(refund).not.toBeNull();
      expect(Number(refund!.amount)).toBe(5000);

      const store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.verifiedStatus).toBe("not_verified");
      void adminUserId;
    });

    it("the badge renders on the storefront header/checkout data for a verified store, and disappears immediately on revocation", async () => {
      const { token, storeId, sellerId } = await createStore("verif-badge@example.com", "verif-badge");
      const { token: adminToken } = await createAndLoginAdmin("verif-badge-admin@example.com");
      await makeFullyEligible(storeId, sellerId);
      await topUpAndVerify(token, adminToken, 5000);

      const apply = await request(app.getHttpServer()).post(`/stores/${storeId}/verification/apply`).set("Authorization", `Bearer ${token}`);
      await request(app.getHttpServer()).post(`/admin/verification/applications/${apply.body.id}/approve`).set("Authorization", `Bearer ${adminToken}`).send({});

      const store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      const before = await request(app.getHttpServer()).get(`/storefront/store?hostname=${store.slug}.goto5x.com`);
      expect(before.body.verified).toBe(true);

      await request(app.getHttpServer())
        .post(`/admin/verification/stores/${storeId}/revoke`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: "Standing admin override for this test." });

      const after = await request(app.getHttpServer()).get(`/storefront/store?hostname=${store.slug}.goto5x.com`);
      expect(after.body.verified).toBe(false);
    });

    it("a Store Health Score drop below threshold independently auto-flags a verified store for re-review and suspends the badge", async () => {
      const { storeId } = await createStore("verif-rereview-health@example.com", "verif-rereview-health");
      await superuser.store.update({ where: { id: storeId }, data: { verifiedStatus: "verified", verifiedSince: new Date() } });
      await superuser.storeHealthScoreHistory.create({ data: { storeId, score: 40, breakdown: [] } }); // below the 80 default threshold

      const reReview = app.get(VerificationReReviewService);
      const result = await reReview.runSweep();
      expect(result.flagged).toBe(1);

      const store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.verifiedStatus).toBe("pending_re_review");
      expect(store.reReviewReason).toContain("health_score_below_threshold");

      const front = await request(app.getHttpServer()).get(`/storefront/store?hostname=${store.slug}.goto5x.com`);
      expect(front.body.verified).toBe(false);
    });

    it("a T&S enforcement action independently auto-flags a verified store for re-review, even with a healthy score", async () => {
      const { storeId, sellerId } = await createStore("verif-rereview-ts@example.com", "verif-rereview-ts");
      await superuser.store.update({ where: { id: storeId }, data: { verifiedStatus: "verified", verifiedSince: new Date() } });
      await superuser.storeHealthScoreHistory.create({ data: { storeId, score: 95, breakdown: [] } }); // healthy
      await superuser.seller.update({ where: { id: sellerId }, data: { lifecycleStatus: "restricted" } });

      const reReview = app.get(VerificationReReviewService);
      const result = await reReview.runSweep();
      expect(result.flagged).toBe(1);

      const store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.verifiedStatus).toBe("pending_re_review");
      expect(store.reReviewReason).toContain("trust_safety_enforcement");
    });

    it("an admin can revoke verified status directly at any time, with notes, audit-logged", async () => {
      const { storeId } = await createStore("verif-direct-revoke@example.com", "verif-direct-revoke");
      const { token: adminToken } = await createAndLoginAdmin("verif-direct-revoke-admin@example.com");
      await superuser.store.update({ where: { id: storeId }, data: { verifiedStatus: "verified", verifiedSince: new Date() } });

      const revoke = await request(app.getHttpServer())
        .post(`/admin/verification/stores/${storeId}/revoke`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: "Direct standing override - unrelated to any re-review flag." });
      expect(revoke.status).toBe(201);

      const store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.verifiedStatus).toBe("revoked");

      const log = await superuser.adminAuditLog.findFirst({ where: { targetType: "store", targetId: storeId, action: "verification.store.revoke" } });
      expect(log).not.toBeNull();
    });

    it("annual re-verification expires a verified store at 12 months and requires a full re-application, never a rubber-stamp renewal", async () => {
      const { token, storeId, sellerId } = await createStore("verif-annual@example.com", "verif-annual");
      const { token: adminToken } = await createAndLoginAdmin("verif-annual-admin@example.com");

      // First cycle: apply, approve, and simulate the 12-month clock having already elapsed.
      await makeFullyEligible(storeId, sellerId);
      await topUpAndVerify(token, adminToken, 5000);
      const firstApply = await request(app.getHttpServer()).post(`/stores/${storeId}/verification/apply`).set("Authorization", `Bearer ${token}`);
      await request(app.getHttpServer()).post(`/admin/verification/applications/${firstApply.body.id}/approve`).set("Authorization", `Bearer ${adminToken}`).send({});
      await superuser.store.update({ where: { id: storeId }, data: { verifiedExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });

      const reReview = app.get(VerificationReReviewService);
      const sweepResult = await reReview.runSweep();
      expect(sweepResult.expired).toBe(1);
      const expiredStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(expiredStore.verifiedStatus).toBe("expired");

      const front = await request(app.getHttpServer()).get(`/storefront/store?hostname=${expiredStore.slug}.goto5x.com`);
      expect(front.body.verified).toBe(false);

      // Re-applying still requires the full live eligibility + admin-audit path - never auto-restored.
      await makeFullyEligible(storeId, sellerId);
      const secondApply = await request(app.getHttpServer()).post(`/stores/${storeId}/verification/apply`).set("Authorization", `Bearer ${token}`);
      expect(secondApply.status).toBe(201);
      expect(secondApply.body.status).toBe("pending_review");
      // Reverification fee defaults to 0 (no new fee) - a documented default, not a fee bypass.
      expect(Number(secondApply.body.feeAmount)).toBe(0);

      const stillExpired = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(stillExpired.verifiedStatus).toBe("expired"); // the mere existence of a pending application never auto-restores verified status
    });
  });
});
