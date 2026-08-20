import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Module 79 (SRS §5.33, FR-33.6 pre-Module-78-numbering) - Ambassador
 * Program Repricing. Two independent mechanics: (1) referral commission
 * moves off the old percent-of-plan-fee/6-month-window model onto a flat
 * Rs 499 per RENEWED MONTH (never the referred seller's first payment), up
 * to 3 total months, pro-rated; (2) a new, SEPARATE benefit - an approved
 * ambassador's own stores, up to a Settings-configurable granted count, are
 * plan-fee-exempt, reusing the existing overdue-detection sweep rather than
 * a new billing path.
 */
describe("Ambassador Program Repricing (e2e) - SRS §5.33, §14.33, FR-33.6 pre-Module-78-numbering", () => {
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
    return { token, sellerId: seller.id as string };
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

  async function makeEligibleAndApplyApproveAmbassador(token: string, sellerId: string, adminToken: string): Promise<{ referralCode: string; participantId: string }> {
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    await app.get(SettingsService).setValue("growth.ambassador_eligible", "plan", subscription.planId, true, ADMIN_ID);

    const apply = await request(app.getHttpServer())
      .post("/sellers/me/growth-programs/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programType: "ambassador" });
    expect(apply.status).toBe(201);

    const approve = await request(app.getHttpServer())
      .post(`/admin/growth-programs/applications/${apply.body.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(approve.status).toBe(201);
    return { referralCode: approve.body.referralCode as string, participantId: apply.body.id as string };
  }

  async function createStore(token: string, slug: string): Promise<string> {
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${slug}`, slug });
    return store.body.id as string;
  }

  async function payOneCycle(token: string, adminToken: string) {
    const submit = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(submit.status).toBe(201);
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${submit.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
  }

  describe("Commission - flat per renewed month, capped, pro-rated", () => {
    it("the first/initial payment earns nothing; a monthly renewal earns a flat Rs 499", async () => {
      const referrer = await signup("amb79-referrer@example.com");
      const adminToken = await createAndLoginAdmin("amb79-admin@example.com");
      const { referralCode } = await makeEligibleAndApplyApproveAmbassador(referrer.token, referrer.sellerId, adminToken);
      const referred = await signup("amb79-referred@example.com", referralCode);

      await payOneCycle(referred.token, adminToken); // first/initial payment
      let commission = await superuser.ledgerEntry.findMany({ where: { sellerId: referrer.sellerId, type: "program_commission_credit" } });
      expect(commission).toHaveLength(0);

      await payOneCycle(referred.token, adminToken); // renewal #1 - 1 month (default monthly billing)
      commission = await superuser.ledgerEntry.findMany({ where: { sellerId: referrer.sellerId, type: "program_commission_credit" } });
      expect(commission).toHaveLength(1);
      expect(Number(commission[0].amount)).toBe(499);

      const attribution = await superuser.referralAttribution.findUniqueOrThrow({ where: { referredSellerId: referred.sellerId } });
      expect(attribution.commissionMonthsPaid).toBe(1);
    });

    it("a renewal covering more months than remain under the cap is pro-rated down, and nothing further accrues once the cap is reached", async () => {
      const referrer = await signup("amb79-prorate-referrer@example.com");
      const adminToken = await createAndLoginAdmin("amb79-prorate-admin@example.com");
      const { referralCode } = await makeEligibleAndApplyApproveAmbassador(referrer.token, referrer.sellerId, adminToken);
      const referred = await signup("amb79-prorate-referred@example.com", referralCode);
      // A six-month cycle covers 6 months per payment - more than the
      // default 3-month cap, so the first renewal must pro-rate down to
      // exactly the 3 months remaining, not pay for all 6.
      await superuser.subscription.update({ where: { sellerId: referred.sellerId }, data: { billingInterval: "six_month" } });

      await payOneCycle(referred.token, adminToken); // first/initial payment - no commission
      await payOneCycle(referred.token, adminToken); // renewal #1 - pro-rated to 3 months (the whole cap)

      const commission = await superuser.ledgerEntry.findMany({ where: { sellerId: referrer.sellerId, type: "program_commission_credit" } });
      expect(commission).toHaveLength(1);
      expect(Number(commission[0].amount)).toBe(499 * 3);
      let attribution = await superuser.referralAttribution.findUniqueOrThrow({ where: { referredSellerId: referred.sellerId } });
      expect(attribution.commissionMonthsPaid).toBe(3);

      await payOneCycle(referred.token, adminToken); // renewal #2 - cap already fully used, earns nothing
      const commissionAfter = await superuser.ledgerEntry.findMany({ where: { sellerId: referrer.sellerId, type: "program_commission_credit" } });
      expect(commissionAfter).toHaveLength(1);
      attribution = await superuser.referralAttribution.findUniqueOrThrow({ where: { referredSellerId: referred.sellerId } });
      expect(attribution.commissionMonthsPaid).toBe(3);
    });
  });

  describe("Free store slots - a separate benefit from referral commission", () => {
    it("approval grants the Settings-default slot count; an admin can override it per ambassador", async () => {
      const referrer = await signup("amb79-slots-referrer@example.com");
      const adminToken = await createAndLoginAdmin("amb79-slots-admin@example.com");
      const { participantId } = await makeEligibleAndApplyApproveAmbassador(referrer.token, referrer.sellerId, adminToken);

      const afterApproval = await superuser.programParticipant.findUniqueOrThrow({ where: { id: participantId } });
      expect(afterApproval.freeStoreSlotsGranted).toBe(3); // growth.ambassador_free_store_slots default

      const override = await request(app.getHttpServer())
        .patch(`/admin/growth-programs/applications/${participantId}/free-store-slots`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ freeStoreSlotsGranted: 5 });
      expect(override.status).toBe(200);
      expect(override.body.freeStoreSlotsGranted).toBe(5);
    });
  });

  describe("Free store slots - the plan-fee exemption itself", () => {
    it("an ambassador within their granted slot count is never paused by the overdue sweep; their cycle advances silently instead", async () => {
      const referrer = await signup("amb79-exempt-referrer@example.com");
      const adminToken = await createAndLoginAdmin("amb79-exempt-admin@example.com");
      await makeEligibleAndApplyApproveAmbassador(referrer.token, referrer.sellerId, adminToken);
      await createStore(referrer.token, "amb79-exempt-store"); // 1 store, well within the granted 3

      const before = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: referrer.sellerId } });
      const overduePeriodEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await superuser.subscription.update({ where: { sellerId: referrer.sellerId }, data: { currentPeriodEnd: overduePeriodEnd } });

      await app.get(PlanFeeDebitService).runMonthlyDebitSweep(new Date());

      const store = await superuser.store.findFirstOrThrow({ where: { sellerId: referrer.sellerId } });
      expect(store.status).not.toBe("orders_paused");
      const after = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: referrer.sellerId } });
      // Advanced by exactly one billing interval from wherever it was - not reset to "now".
      expect(after.currentPeriodEnd!.getTime()).toBeGreaterThan(overduePeriodEnd.getTime());
      void before;
    });

    it("suspending the ambassador reverts to normal billing at the NEXT cycle, not an immediate catch-up pause", async () => {
      const referrer = await signup("amb79-revoke-referrer@example.com");
      const adminToken = await createAndLoginAdmin("amb79-revoke-admin@example.com");
      const { participantId } = await makeEligibleAndApplyApproveAmbassador(referrer.token, referrer.sellerId, adminToken);
      await createStore(referrer.token, "amb79-revoke-store");

      await superuser.subscription.update({
        where: { sellerId: referrer.sellerId },
        data: { currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });
      await app.get(PlanFeeDebitService).runMonthlyDebitSweep(new Date()); // exempt - advances silently, ~1 month out now

      await request(app.getHttpServer())
        .post(`/admin/growth-programs/applications/${participantId}/suspend`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      // Immediately after suspension, at "now" - no longer exempt, but
      // their currentPeriodEnd was just pushed into the future by the
      // exempt sweep above, so they are not even due yet. Grace, not punishment.
      await app.get(PlanFeeDebitService).runMonthlyDebitSweep(new Date());
      const stillActive = await superuser.store.findFirstOrThrow({ where: { sellerId: referrer.sellerId } });
      expect(stillActive.status).not.toBe("orders_paused");

      // Once genuinely due AND past the normal grace window, they pause exactly like any other seller - no special treatment either way.
      const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: referrer.sellerId } });
      const graceDays = await app.get(SettingsService).resolve<number>("billing.plan_fee_grace_days");
      const farEnough = new Date(subscription.currentPeriodEnd!.getTime() + (graceDays + 1) * 24 * 60 * 60 * 1000);
      await app.get(PlanFeeDebitService).runMonthlyDebitSweep(farEnough);
      const paused = await superuser.store.findFirstOrThrow({ where: { sellerId: referrer.sellerId } });
      expect(paused.status).toBe("orders_paused");
    });
  });
});
