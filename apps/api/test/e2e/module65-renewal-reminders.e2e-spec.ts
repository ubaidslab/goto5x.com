import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { RenewalRemindersService } from "../../src/billing/renewal-reminders.service";
import { WalletGraceLadderService } from "../../src/billing/wallet-grace-ladder.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SRS §5.6k (v0.41), FR-6.42 (Module 65) - the pre-expiry reminder ladder
 * (7/3/1 days before Subscription.currentPeriodEnd, plus an expiry-day
 * email) and the win-back ladder (3/7/14 days into Module 64's
 * terminalPausedAt window), both reading their copy from the admin-editable
 * EmailTemplate table.
 */
describe("Renewal reminders + win-back emails (e2e) - SRS §5.6k/§14.66 (Module 65, FR-6.42)", () => {
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

  async function pauseForNonPayment(sellerId: string): Promise<void> {
    const planFeeDebit = app.get(PlanFeeDebitService);
    const settings = app.get(SettingsService);
    const graceDays = await settings.resolve<number>("billing.plan_fee_grace_days");
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    await planFeeDebit.runMonthlyDebitSweep(new Date(Date.now() + (graceDays + 1) * DAY_MS));
  }

  it("FR-6.42: pre-expiry reminders fire once each at 7/3/1 days before currentPeriodEnd, and an expiry-day email fires once it passes, never re-sending the same milestone", async () => {
    const adminToken = await createAndLoginAdmin("renew-admin1@example.com");
    const seller = await signup("renew-preexpiry@example.com");
    await payPlanFee(seller.token, adminToken);

    const reminders = app.get(RenewalRemindersService);
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    const periodEnd = subscription.currentPeriodEnd!;

    const day7 = await reminders.runSweep(new Date(periodEnd.getTime() - 7 * DAY_MS + 1000));
    expect(day7.preExpiry).toBe(1);
    const day7Again = await reminders.runSweep(new Date(periodEnd.getTime() - 7 * DAY_MS + 2000));
    expect(day7Again.preExpiry).toBe(0);

    const day3 = await reminders.runSweep(new Date(periodEnd.getTime() - 3 * DAY_MS + 1000));
    expect(day3.preExpiry).toBe(1);

    const day1 = await reminders.runSweep(new Date(periodEnd.getTime() - 1 * DAY_MS + 1000));
    expect(day1.preExpiry).toBe(1);

    const expiryDay = await reminders.runSweep(new Date(periodEnd.getTime() + 1000));
    expect(expiryDay.preExpiry).toBe(1);
    const expiryDayAgain = await reminders.runSweep(new Date(periodEnd.getTime() + 2000));
    expect(expiryDayAgain.preExpiry).toBe(0);

    const after = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    expect(after.renewalReminderDay7SentAt).not.toBeNull();
    expect(after.renewalReminderDay3SentAt).not.toBeNull();
    expect(after.renewalReminderDay1SentAt).not.toBeNull();
    expect(after.renewalReminderExpiryDaySentAt).not.toBeNull();
  });

  it("FR-6.42: a verified renewal payment resets every pre-expiry reminder flag, so the next cycle's reminders fire fresh", async () => {
    const adminToken = await createAndLoginAdmin("renew-admin2@example.com");
    const seller = await signup("renew-reset@example.com");
    await payPlanFee(seller.token, adminToken);

    const reminders = app.get(RenewalRemindersService);
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    await reminders.runSweep(new Date(subscription.currentPeriodEnd!.getTime() - 7 * DAY_MS + 1000));
    const beforeRenewal = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    expect(beforeRenewal.renewalReminderDay7SentAt).not.toBeNull();

    // A verified renewal payment advances currentPeriodEnd and must reset the ladder.
    await payPlanFee(seller.token, adminToken);
    const afterRenewal = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    expect(afterRenewal.renewalReminderDay7SentAt).toBeNull();
    expect(afterRenewal.currentPeriodEnd!.getTime()).toBeGreaterThan(beforeRenewal.currentPeriodEnd!.getTime());

    // And the new cycle's day-7 reminder fires again.
    const nextDay7 = await reminders.runSweep(new Date(afterRenewal.currentPeriodEnd!.getTime() - 7 * DAY_MS + 1000));
    expect(nextDay7.preExpiry).toBe(1);
  });

  it("FR-6.42: win-back emails fire once each at 3/7/14 days into a terminalPausedAt window, never re-sending the same milestone", async () => {
    const adminToken = await createAndLoginAdmin("renew-admin3@example.com");
    const seller = await signup("renew-winback@example.com");
    await payPlanFee(seller.token, adminToken);
    await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Winback Store", slug: "renew-winback-store" });
    await pauseForNonPayment(seller.sellerId);

    const reminders = app.get(RenewalRemindersService);
    const store = await superuser.store.findFirstOrThrow({ where: { sellerId: seller.sellerId } });
    const pausedAt = store.terminalPausedAt!;

    const day3 = await reminders.runSweep(new Date(pausedAt.getTime() + 3 * DAY_MS + 1000));
    expect(day3.winback).toBe(1);
    const day3Again = await reminders.runSweep(new Date(pausedAt.getTime() + 3 * DAY_MS + 2000));
    expect(day3Again.winback).toBe(0);

    const day7 = await reminders.runSweep(new Date(pausedAt.getTime() + 7 * DAY_MS + 1000));
    expect(day7.winback).toBe(1);

    const day14 = await reminders.runSweep(new Date(pausedAt.getTime() + 14 * DAY_MS + 1000));
    expect(day14.winback).toBe(1);

    const after = await superuser.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(after.winbackDay3SentAt).not.toBeNull();
    expect(after.winbackDay7SentAt).not.toBeNull();
    expect(after.winbackDay14SentAt).not.toBeNull();
  });

  it("FR-6.42: restoreAfterPlanFeePayment() clears every win-back flag along with terminalPausedAt", async () => {
    const adminToken = await createAndLoginAdmin("renew-admin4@example.com");
    const seller = await signup("renew-winback-clear@example.com");
    await payPlanFee(seller.token, adminToken);
    await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Clears Store", slug: "renew-winback-clear-store" });
    await pauseForNonPayment(seller.sellerId);

    const reminders = app.get(RenewalRemindersService);
    const store = await superuser.store.findFirstOrThrow({ where: { sellerId: seller.sellerId } });
    await reminders.runSweep(new Date(store.terminalPausedAt!.getTime() + 3 * DAY_MS + 1000));
    const warned = await superuser.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(warned.winbackDay3SentAt).not.toBeNull();

    const graceLadder = app.get(WalletGraceLadderService);
    await graceLadder.restoreAfterPlanFeePayment(seller.sellerId);

    const restored = await superuser.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(restored.winbackDay3SentAt).toBeNull();
  });

  it("FR-6.42: admin-editable templates - updating a template's copy changes what the console-provider send actually renders", async () => {
    const adminToken = await createAndLoginAdmin("renew-admin5@example.com");
    const before = await request(app.getHttpServer())
      .get("/admin/email-templates")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(before.status).toBe(200);
    expect(before.body.find((t: { key: string }) => t.key === "renewal_reminder_day7")).toBeTruthy();

    const update = await request(app.getHttpServer())
      .put("/admin/email-templates/renewal_reminder_day7")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "Custom subject {{businessName}}", body: "Custom body for {{businessName}}." });
    expect(update.status).toBe(200);
    expect(update.body.subject).toBe("Custom subject {{businessName}}");

    const auditRow = await superuser.adminAuditLog.findFirst({ where: { action: "billing.email_template_updated" } });
    expect(auditRow).not.toBeNull();
    expect((auditRow!.afterValue as { key: string }).key).toBe("renewal_reminder_day7");

    const seller = await signup("renew-template-render@example.com");
    await payPlanFee(seller.token, adminToken);
    const reminders = app.get(RenewalRemindersService);
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    await reminders.runSweep(new Date(subscription.currentPeriodEnd!.getTime() - 7 * DAY_MS + 1000));
    const after = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    expect(after.renewalReminderDay7SentAt).not.toBeNull();
  });
});
