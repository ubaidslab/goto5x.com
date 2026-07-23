import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Module 22 Phase A (SRS §5.33, FR-33.1-33.4/33.9/33.10, checklist §14.33)
 * - the shared referral engine: application/approval, single-attribution
 * enforcement, commission-base restriction, the reactivated Payout Request
 * & Disbursement Engine, and the self-referral fraud signal.
 */
describe("Growth & Partner Programs Phase A (e2e) - SRS §5.33, §14.33", () => {
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

  async function signup(email: string, referralCode?: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}`, referralCode });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, userId: user.id as string, sellerId: seller.id as string };
  }

  async function createAndLoginAdmin(email: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  async function topUpAndVerify(token: string, adminToken: string, amount: number) {
    const req = await request(app.getHttpServer()).post("/sellers/me/wallet/topup-requests").set("Authorization", `Bearer ${token}`).send({ amount });
    await request(app.getHttpServer()).post(`/admin/wallet-topups/${req.body.request.id}/verify`).set("Authorization", `Bearer ${adminToken}`);
  }

  async function applyApproveAmbassador(token: string, sellerId: string, adminUserId: string): Promise<string> {
    // Ambassador requires an eligible paid plan (FR-33.5) - grant it directly against the seller's own plan.
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    const settings = app.get(SettingsService);
    await settings.setValue("growth.ambassador_eligible", "plan", subscription.planId, true, ADMIN_ID);

    const apply = await request(app.getHttpServer())
      .post("/sellers/me/growth-programs/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programType: "ambassador" });
    expect(apply.status).toBe(201);

    const approved = await superuser.programParticipant.update({
      where: { id: apply.body.id },
      data: { status: "approved", referralCode: `amb-${apply.body.id.slice(0, 8)}`, decidedByAdminUserId: adminUserId, decidedAt: new Date() },
    });
    return approved.referralCode!;
  }

  describe("Application shape (FR-33.2/33.5)", () => {
    it("rejects an Ambassador application without an eligible paid plan", async () => {
      const { token } = await signup("ambassador-noplan@example.com");
      const res = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/applications")
        .set("Authorization", `Bearer ${token}`)
        .send({ programType: "ambassador" });
      expect(res.status).toBe(403);
    });

    it("Student Referral has no plan-eligibility gate; admin approve/reject/suspend/terminate all work; no self-serve join", async () => {
      const { token, sellerId } = await signup("student@example.com");
      const adminToken = await createAndLoginAdmin("growth-admin-1@example.com");

      const apply = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/applications")
        .set("Authorization", `Bearer ${token}`)
        .send({ programType: "student_referral" });
      expect(apply.status).toBe(201);
      const participant = await superuser.programParticipant.findUniqueOrThrow({ where: { id: apply.body.id } });
      expect(participant.status).toBe("pending");
      expect(participant.referralCode).toBeNull(); // never issued before approval - no self-serve join

      // A second application to the SAME program is rejected.
      const dupe = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/applications")
        .set("Authorization", `Bearer ${token}`)
        .send({ programType: "student_referral" });
      expect(dupe.status).toBe(400);

      const approve = await request(app.getHttpServer())
        .post(`/admin/growth-programs/applications/${apply.body.id}/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(approve.status).toBe(201);
      expect(approve.body.status).toBe("approved");
      expect(approve.body.referralCode).toBeTruthy();

      const suspend = await request(app.getHttpServer())
        .post(`/admin/growth-programs/applications/${apply.body.id}/suspend`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: "suspicious activity" });
      expect(suspend.status).toBe(201);
      expect(suspend.body.status).toBe("suspended");

      // Cannot suspend a not-approved (already suspended) participant again.
      const reSuspend = await request(app.getHttpServer())
        .post(`/admin/growth-programs/applications/${apply.body.id}/suspend`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(reSuspend.status).toBe(400);

      const terminate = await request(app.getHttpServer())
        .post(`/admin/growth-programs/applications/${apply.body.id}/terminate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: "Terms violation" });
      expect(terminate.status).toBe(201);
      expect(terminate.body.status).toBe("terminated");

      const auditLogs = await superuser.adminAuditLog.findMany({ where: { targetId: apply.body.id } });
      expect(auditLogs.map((l) => l.action)).toEqual(
        expect.arrayContaining([
          "growth_programs.application_approved",
          "growth_programs.participant_suspended",
          "growth_programs.participant_terminated",
        ]),
      );
      void sellerId;
    });
  });

  describe("Single-referral-source attribution (FR-33.1/33.3) - DB-level enforcement, never GMV/top-ups", () => {
    it("attributes a referred seller at signup, rejects a second attribution at the DATA layer (unique constraint), and never accrues commission from top-ups/GMV", async () => {
      const adminToken = await createAndLoginAdmin("growth-admin-2@example.com");
      const ambassador = await signup("ambassador-attrib@example.com");
      const ambassadorCode = await applyApproveAmbassador(ambassador.token, ambassador.sellerId, ADMIN_ID);

      // A second, independent approved Ambassador - used to prove attribution truly locks to the FIRST valid referral.
      const secondAmbassador = await signup("ambassador-second@example.com");
      const secondCode = await applyApproveAmbassador(secondAmbassador.token, secondAmbassador.sellerId, ADMIN_ID);

      const referred = await signup("referred-seller@example.com", ambassadorCode);
      const attribution = await superuser.referralAttribution.findUniqueOrThrow({ where: { referredSellerId: referred.sellerId } });
      expect(attribution.programType).toBe("ambassador");

      // A DIRECT attempt to create a second attribution row for the SAME
      // referred seller must fail at the database layer (a real unique-
      // constraint violation), independent of any application-level check
      // or UI - this is what "enforced at the data-model level" means.
      const secondParticipant = await superuser.programParticipant.findUniqueOrThrow({
        where: { uniq_program_participant_seller_program: { sellerId: secondAmbassador.sellerId, programType: "ambassador" } },
      });
      await expect(
        superuser.referralAttribution.create({
          data: {
            referredSellerId: referred.sellerId,
            participantId: secondParticipant.id,
            programType: "ambassador",
            commissionWindowEndsAt: new Date(Date.now() + 1000),
          },
        }),
      ).rejects.toThrow(/Unique constraint/i);

      // The service-level path (a second application/link resolving to the
      // same referred seller) also cannot create a second row - it silently
      // does nothing (never surfaces as a signup error), leaving exactly
      // one attribution, still pointing at the FIRST ambassador.
      const referralAttributionModule = await import("../../src/growth-programs/referral-attribution.service");
      const referralAttributionService = app.get(referralAttributionModule.ReferralAttributionService);
      await referralAttributionService.tryAttribute(referred.sellerId, secondCode);
      const attributionsAfter = await superuser.referralAttribution.findMany({ where: { referredSellerId: referred.sellerId } });
      expect(attributionsAfter).toHaveLength(1);
      expect(attributionsAfter[0].participantId).toBe(attribution.participantId);

      // --- Commission accrual: ONLY from the referred seller's own plan-subscription fee ---
      await topUpAndVerify(referred.token, adminToken, 5000);

      // A wallet top-up must NEVER generate referral commission.
      const commissionAfterTopup = await superuser.ledgerEntry.findMany({
        where: { sellerId: ambassador.sellerId, type: "program_commission_credit" },
      });
      expect(commissionAfterTopup).toHaveLength(0);

      // An order/GMV-driven commission_accrued entry on the REFERRED seller's own store must also never generate referral commission.
      await superuser.ledgerEntry.create({ data: { sellerId: referred.sellerId, type: "commission_accrued", amount: 500, currency: "PKR" } });
      const commissionAfterGmv = await superuser.ledgerEntry.findMany({
        where: { sellerId: ambassador.sellerId, type: "program_commission_credit" },
      });
      expect(commissionAfterGmv).toHaveLength(0);

      // Only the referred seller's OWN plan-subscription fee debit generates referral commission, at the configured rate.
      const starterPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } });
      await request(app.getHttpServer())
        .post("/sellers/me/subscription/change")
        .set("Authorization", `Bearer ${referred.token}`)
        .send({ planId: starterPlan.id });
      const referredSubscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: referred.sellerId } });
      const dueDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      await superuser.subscription.update({ where: { id: referredSubscription.id }, data: { currentPeriodEnd: dueDate } });

      const planFeeDebit = app.get(PlanFeeDebitService);
      await planFeeDebit.runMonthlyDebitSweep(dueDate);

      const commissionEntry = await superuser.ledgerEntry.findFirstOrThrow({
        where: { sellerId: ambassador.sellerId, type: "program_commission_credit" },
      });
      const expectedCommission = Number(starterPlan.price) * 0.08; // growth.ambassador_commission_percent default
      expect(Number(commissionEntry.amount)).toBeCloseTo(expectedCommission, 2);
    });

    it("a stale/unmatched referral code never blocks signup and creates no attribution", async () => {
      const { sellerId } = await signup("no-referral@example.com", "this-code-matches-nothing");
      const attribution = await superuser.referralAttribution.findUnique({ where: { referredSellerId: sellerId } });
      expect(attribution).toBeNull();
    });
  });

  describe("Withdrawal (Payout Request & Disbursement Engine, SRS §5.6b reactivated, FR-33.9) - full negative space", () => {
    it("threshold not met: a balance below the minimum withdrawal amount is rejected", async () => {
      const { token, sellerId } = await signup("withdraw-threshold@example.com");
      await applyApproveAmbassador(token, sellerId, ADMIN_ID);
      // No commission ever credited - balance is 0, below the default minimum.
      const res = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 1 });
      expect(res.status).toBe(400);
    });

    it("unapproved participant: a still-pending applicant cannot request a withdrawal even with wallet balance", async () => {
      const { token, sellerId } = await signup("withdraw-unapproved@example.com");
      await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/applications")
        .set("Authorization", `Bearer ${token}`)
        .send({ programType: "student_referral" });
      // Give this seller balance some other way, to isolate the "not approved" gate specifically.
      await superuser.ledgerEntry.create({ data: { sellerId, type: "program_reward_credit", amount: 5000, currency: "PKR" } });

      const res = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 100 });
      expect(res.status).toBe(403);
    });

    it("suspended participant: withdrawal is rejected once a previously-approved participant is suspended", async () => {
      const adminToken = await createAndLoginAdmin("growth-admin-3@example.com");
      const { token, sellerId } = await signup("withdraw-suspended@example.com");
      await applyApproveAmbassador(token, sellerId, ADMIN_ID);
      await superuser.ledgerEntry.create({ data: { sellerId, type: "program_reward_credit", amount: 5000, currency: "PKR" } });

      const participant = await superuser.programParticipant.findFirstOrThrow({ where: { sellerId, programType: "ambassador" } });
      await request(app.getHttpServer())
        .post(`/admin/growth-programs/applications/${participant.id}/suspend`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      const res = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 100 });
      expect(res.status).toBe(403);
    });

    it("double-request on the same balance: a second request cannot be created while one is outstanding", async () => {
      const { token, sellerId } = await signup("withdraw-double@example.com");
      await applyApproveAmbassador(token, sellerId, ADMIN_ID);
      await superuser.ledgerEntry.create({ data: { sellerId, type: "program_reward_credit", amount: 5000, currency: "PKR" } });

      const first = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 1000 });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 500 });
      expect(second.status).toBe(400);
    });

    it("admin rejection restores the requestable balance: nothing was ever debited, so a new request can follow immediately", async () => {
      const adminToken = await createAndLoginAdmin("growth-admin-4@example.com");
      const { token, sellerId } = await signup("withdraw-reject@example.com");
      await applyApproveAmbassador(token, sellerId, ADMIN_ID);
      await superuser.ledgerEntry.create({ data: { sellerId, type: "program_reward_credit", amount: 5000, currency: "PKR" } });

      const first = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 1000 });
      expect(first.status).toBe(201);

      const balanceBeforeReject = (await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`)).body.balance;
      expect(balanceBeforeReject).toBe(5000); // rejection hasn't happened yet, but requesting alone must never debit either

      const reject = await request(app.getHttpServer())
        .post(`/admin/growth-programs/withdrawals/${first.body.id}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: "insufficient proof" });
      expect(reject.status).toBe(201);
      expect(reject.body.status).toBe("rejected");

      const balanceAfterReject = (await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`)).body.balance;
      expect(balanceAfterReject).toBe(5000); // untouched - nothing was ever debited

      // A new request now succeeds - the "outstanding request" lock cleared.
      const second = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 2000 });
      expect(second.status).toBe(201);
    });

    it("clawback after an already-paid withdrawal: balance goes negative, and the natural recovery path is that no further withdrawal can be requested until it clears", async () => {
      const adminToken = await createAndLoginAdmin("growth-admin-5@example.com");
      const { token, sellerId } = await signup("withdraw-clawback@example.com");
      await applyApproveAmbassador(token, sellerId, ADMIN_ID);
      await superuser.ledgerEntry.create({ data: { sellerId, type: "program_reward_credit", amount: 5000, currency: "PKR" } });

      const requestRes = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 5000 });
      expect(requestRes.status).toBe(201);
      const payoutId = requestRes.body.id as string;

      await request(app.getHttpServer()).post(`/admin/growth-programs/withdrawals/${payoutId}/approve`).set("Authorization", `Bearer ${adminToken}`).send({});
      const paid = await request(app.getHttpServer())
        .post(`/admin/growth-programs/withdrawals/${payoutId}/paid`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ paymentReference: "BANK-REF-001" });
      expect(paid.status).toBe(201);
      expect(paid.body.status).toBe("paid");

      const balanceAfterPaid = (await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`)).body.balance;
      expect(balanceAfterPaid).toBe(0); // fully withdrawn

      // A fraud finding claws back MORE than the (now zero) remaining balance - this must succeed and go negative.
      const clawback = await request(app.getHttpServer())
        .post(`/admin/growth-programs/withdrawals/sellers/${sellerId}/clawback`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ amount: 1500, notes: "confirmed self-referral fraud" });
      expect(clawback.status).toBe(201);

      const balanceAfterClawback = (await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`)).body.balance;
      expect(balanceAfterClawback).toBe(-1500);

      // Recovery path: the negative balance itself blocks any further withdrawal until new earnings offset it.
      const blockedWithdrawal = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/withdrawals")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 1 });
      expect(blockedWithdrawal.status).toBe(400);
    });
  });

  describe("Self-referral fraud signal (FR-33.10)", () => {
    it("flags a referral attribution whose referrer and referred seller share a signup IP/device fingerprint", async () => {
      const adminToken = await createAndLoginAdmin("growth-admin-6@example.com");
      const ambassador = await signup("fraud-ambassador@example.com");
      const ambassadorCode = await applyApproveAmbassador(ambassador.token, ambassador.sellerId, ADMIN_ID);
      const referred = await signup("fraud-referred@example.com", ambassadorCode);

      // cnicHash/payment-instrument hashes are both @unique across every
      // seller (FR-30.1/30.3), so two real sellers can never literally
      // share one - the one signal that genuinely CAN overlap between two
      // real accounts is signup IP/device fingerprint (no uniqueness
      // constraint there, by design - see RiskScoreService's own
      // `hasDeviceIpSignal`/`matchesSuspendedSellerCluster`, which this
      // monitor's comparison logic mirrors).
      const sharedIp = "203.0.113.77";
      await superuser.userSecurityEvent.create({
        data: { userId: ambassador.userId, eventType: "signup", ipAddress: sharedIp },
      });
      await superuser.userSecurityEvent.create({
        data: { userId: referred.userId, eventType: "signup", ipAddress: sharedIp },
      });

      const flags = await request(app.getHttpServer()).get("/admin/trust-safety/monitors/self-referral").set("Authorization", `Bearer ${adminToken}`);
      expect(flags.status).toBe(200);
      expect(flags.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ referrerSellerId: ambassador.sellerId, referredSellerId: referred.sellerId, matchedSignal: "device_or_ip" }),
        ]),
      );
    });

    it("does not flag an unrelated referrer/referred pair with no overlapping signals", async () => {
      const adminToken = await createAndLoginAdmin("growth-admin-6b@example.com");
      const ambassador = await signup("clean-ambassador@example.com");
      const ambassadorCode = await applyApproveAmbassador(ambassador.token, ambassador.sellerId, ADMIN_ID);
      const referred = await signup("clean-referred@example.com", ambassadorCode);

      // Every signup in this whole test file goes through the SAME
      // supertest client, so real captured signup IPs are naturally
      // identical across every test (a real deployment would see distinct
      // buyer IPs; this test harness does not) - overwrite both accounts'
      // signup security events with deliberately DIFFERENT values so this
      // "no false positive" case is genuinely deterministic, not an
      // accident of shared test-client IP.
      await superuser.userSecurityEvent.deleteMany({ where: { userId: { in: [ambassador.userId, referred.userId] }, eventType: "signup" } });
      await superuser.userSecurityEvent.create({ data: { userId: ambassador.userId, eventType: "signup", ipAddress: "198.51.100.10" } });
      await superuser.userSecurityEvent.create({ data: { userId: referred.userId, eventType: "signup", ipAddress: "198.51.100.99" } });

      const flags = await request(app.getHttpServer()).get("/admin/trust-safety/monitors/self-referral").set("Authorization", `Bearer ${adminToken}`);
      expect(flags.status).toBe(200);
      expect(flags.body).toEqual([]);
    });
  });

  describe("Per-program report (FR-33.11)", () => {
    it("reports application/approval/rejection counts for a program", async () => {
      const adminToken = await createAndLoginAdmin("growth-admin-7@example.com");
      const { token: token1 } = await signup("report-seller-1@example.com");
      const { token: token2 } = await signup("report-seller-2@example.com");

      const apply1 = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/applications")
        .set("Authorization", `Bearer ${token1}`)
        .send({ programType: "student_referral" });
      const apply2 = await request(app.getHttpServer())
        .post("/sellers/me/growth-programs/applications")
        .set("Authorization", `Bearer ${token2}`)
        .send({ programType: "student_referral" });

      await request(app.getHttpServer()).post(`/admin/growth-programs/applications/${apply1.body.id}/approve`).set("Authorization", `Bearer ${adminToken}`).send({});
      await request(app.getHttpServer()).post(`/admin/growth-programs/applications/${apply2.body.id}/reject`).set("Authorization", `Bearer ${adminToken}`).send({});

      const report = await request(app.getHttpServer()).get("/admin/growth-programs/reports/student_referral").set("Authorization", `Bearer ${adminToken}`);
      expect(report.status).toBe(200);
      expect(report.body.totalApplications).toBe(2);
      expect(report.body.everApproved).toBe(1);
      expect(report.body.rejected).toBe(1);
      expect(report.body.rejectionRatePercent).toBe(50);
    });
  });
});
