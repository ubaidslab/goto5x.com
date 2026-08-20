import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Module 78 (SRS §5.33, FR-33.5) - Referral Program Rename. Student
 * Referral, renamed "Commerce Students Support," moves off the old shared
 * percent-of-plan-fee/time-window model (still used by Ambassador/Creator,
 * unchanged) onto a flat PKR amount per RENEWAL - never the referred
 * seller's first/initial payment - capped by count
 * (ReferralAttribution.renewalPayoutCount), not time. Admin approval stays
 * the existing, unchanged gate (FR-33.2).
 */
describe("Referral Program Rename - Commerce Students Support (e2e) - SRS §5.33, §14.33, FR-33.5", () => {
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

  async function applyApproveStudentReferral(token: string, adminUserId: string): Promise<string> {
    const apply = await request(app.getHttpServer())
      .post("/sellers/me/growth-programs/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programType: "student_referral" });
    expect(apply.status).toBe(201);
    const approved = await superuser.programParticipant.update({
      where: { id: apply.body.id },
      data: { status: "approved", referralCode: `stu-${apply.body.id.slice(0, 8)}`, decidedByAdminUserId: adminUserId, decidedAt: new Date() },
    });
    return approved.referralCode!;
  }

  /** Submits + admin-verifies one plan-fee payment cycle for the seller, returning whether the flow reported it as a renewal. */
  async function payOneCycle(token: string, adminToken: string) {
    const submit = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(submit.status).toBe(201);
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${submit.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
    return submit.body.isRenewal as boolean;
  }

  it("the first/initial payment never earns commission; each of up to 2 renewals earns a flat Rs 345, the 3rd renewal earns nothing", async () => {
    const referrer = await signup("csr-referrer@example.com");
    const adminToken = await createAndLoginAdmin("csr-admin@example.com");
    const referralCode = await applyApproveStudentReferral(referrer.token, "00000000-0000-0000-0000-000000000000");

    const referred = await signup("csr-referred@example.com", referralCode);
    const attribution = await superuser.referralAttribution.findUniqueOrThrow({ where: { referredSellerId: referred.sellerId } });
    expect(attribution.programType).toBe("student_referral");
    expect(attribution.renewalPayoutCount).toBe(0);

    // Cycle 1 - the referred seller's first/initial plan-fee payment.
    const firstIsRenewal = await payOneCycle(referred.token, adminToken);
    expect(firstIsRenewal).toBe(false);
    let commission = await superuser.ledgerEntry.findMany({ where: { sellerId: referrer.sellerId, type: "program_commission_credit" } });
    expect(commission).toHaveLength(0);

    // Cycle 2 - renewal #1 -> Rs 345.
    const secondIsRenewal = await payOneCycle(referred.token, adminToken);
    expect(secondIsRenewal).toBe(true);
    commission = await superuser.ledgerEntry.findMany({ where: { sellerId: referrer.sellerId, type: "program_commission_credit" } });
    expect(commission).toHaveLength(1);
    expect(Number(commission[0].amount)).toBe(345);
    let attributionAfter = await superuser.referralAttribution.findUniqueOrThrow({ where: { id: attribution.id } });
    expect(attributionAfter.renewalPayoutCount).toBe(1);

    // Cycle 3 - renewal #2 -> another Rs 345 (the cap).
    await payOneCycle(referred.token, adminToken);
    commission = await superuser.ledgerEntry.findMany({ where: { sellerId: referrer.sellerId, type: "program_commission_credit" } });
    expect(commission).toHaveLength(2);
    attributionAfter = await superuser.referralAttribution.findUniqueOrThrow({ where: { id: attribution.id } });
    expect(attributionAfter.renewalPayoutCount).toBe(2);

    // Cycle 4 - renewal #3, past the cap -> no further commission, count unchanged.
    await payOneCycle(referred.token, adminToken);
    commission = await superuser.ledgerEntry.findMany({ where: { sellerId: referrer.sellerId, type: "program_commission_credit" } });
    expect(commission).toHaveLength(2);
    attributionAfter = await superuser.referralAttribution.findUniqueOrThrow({ where: { id: attribution.id } });
    expect(attributionAfter.renewalPayoutCount).toBe(2);
  });

  it("the flat rate and renewal cap are Settings-configurable, admin-editable with no deploy", async () => {
    const referrer = await signup("csr-config-referrer@example.com");
    const adminToken = await createAndLoginAdmin("csr-config-admin@example.com");
    const referralCode = await applyApproveStudentReferral(referrer.token, "00000000-0000-0000-0000-000000000000");
    const referred = await signup("csr-config-referred@example.com", referralCode);

    await app.get(SettingsService).setValue("growth.student_referral_flat_commission_pkr", "global", null, 500, "00000000-0000-0000-0000-000000000000");
    await app.get(SettingsService).setValue("growth.student_referral_max_renewal_payouts", "global", null, 1, "00000000-0000-0000-0000-000000000000");

    await payOneCycle(referred.token, adminToken); // initial - no commission
    await payOneCycle(referred.token, adminToken); // renewal #1 - Rs 500
    await payOneCycle(referred.token, adminToken); // renewal #2 - past the (now lower) cap of 1

    const commission = await superuser.ledgerEntry.findMany({ where: { sellerId: referrer.sellerId, type: "program_commission_credit" } });
    expect(commission).toHaveLength(1);
    expect(Number(commission[0].amount)).toBe(500);
  });
});
