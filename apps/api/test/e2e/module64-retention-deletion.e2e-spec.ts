import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { RetentionService } from "../../src/billing/retention.service";
import { WalletGraceLadderService } from "../../src/billing/wallet-grace-ladder.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SRS §5.6k (v0.41), FR-6.41 (Module 64) - 14-day retention window and its
 * scheduled deletion job. The founder's exact deletion/never-delete scope,
 * obtained via clarifying question before this was built, is the binding
 * spec these tests prove against.
 */
describe("14-day retention + scheduled deletion (e2e) - SRS §5.6k/§14.66 (Module 64, FR-6.41)", () => {
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

  /** Pauses the seller's store(s) for genuine plan-fee non-payment, going through the real code path (not a direct DB update) so terminalPausedAt is set exactly as production would set it. */
  async function pauseForNonPayment(sellerId: string): Promise<void> {
    const planFeeDebit = app.get(PlanFeeDebitService);
    const settings = app.get(SettingsService);
    const graceDays = await settings.resolve<number>("billing.plan_fee_grace_days");
    await superuser.subscription.update({ where: { sellerId }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    await planFeeDebit.runMonthlyDebitSweep(new Date(Date.now() + (graceDays + 1) * DAY_MS));
  }

  it("FR-6.41: a store paused for non-payment gets terminalPausedAt set", async () => {
    const adminToken = await createAndLoginAdmin("retain-admin1@example.com");
    const seller = await signup("retain-pause@example.com");
    await payPlanFee(seller.token, adminToken);
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Retain Store", slug: "retain-pause-store" });

    await pauseForNonPayment(seller.sellerId);

    const row = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    expect(row.status).toBe("orders_paused");
    expect(row.terminalPausedAt).not.toBeNull();
  });

  it("warning emails fire once each at day 0/7/13 and never re-send the same milestone", async () => {
    const adminToken = await createAndLoginAdmin("retain-admin2@example.com");
    const seller = await signup("retain-warnings@example.com");
    await payPlanFee(seller.token, adminToken);
    await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Warnings Store", slug: "retain-warnings-store" });
    await pauseForNonPayment(seller.sellerId);

    const retention = app.get(RetentionService);
    const store = await superuser.store.findFirstOrThrow({ where: { sellerId: seller.sellerId } });
    const pausedAt = store.terminalPausedAt!;

    const day0 = await retention.runSweep(new Date(pausedAt.getTime() + 1000));
    expect(day0.warned).toBe(1);
    const day0Again = await retention.runSweep(new Date(pausedAt.getTime() + 2000));
    expect(day0Again.warned).toBe(0); // already sent - never re-sends

    const day7 = await retention.runSweep(new Date(pausedAt.getTime() + 7 * DAY_MS + 1000));
    expect(day7.warned).toBe(1);

    const day13 = await retention.runSweep(new Date(pausedAt.getTime() + 13 * DAY_MS + 1000));
    expect(day13.warned).toBe(1);

    const afterAll3 = await superuser.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(afterAll3.retentionWarningDay0SentAt).not.toBeNull();
    expect(afterAll3.retentionWarningDay7SentAt).not.toBeNull();
    expect(afterAll3.retentionWarningDay13SentAt).not.toBeNull();
  });

  it("FR-6.41: the deletion job deletes exactly the founder-specified scope and preserves everything else, audit-logged", async () => {
    const adminToken = await createAndLoginAdmin("retain-admin3@example.com");
    const seller = await signup("retain-delete@example.com");
    await payPlanFee(seller.token, adminToken);
    const storeRes = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Delete Store", slug: "retain-delete-store" });
    const storeId = storeRes.body.id as string;

    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ title: "Doomed Product", status: "active" });
    await superuser.discountCode.create({
      data: { storeId, code: "DOOMED10", type: "percentage", value: 10 },
    });

    await pauseForNonPayment(seller.sellerId);
    // Back-date past the retention window (default 14 days).
    await superuser.store.update({ where: { id: storeId }, data: { terminalPausedAt: new Date(Date.now() - 20 * DAY_MS) } });

    const retention = app.get(RetentionService);
    const result = await retention.runSweep(new Date());
    expect(result.deleted).toBe(1);

    // Deleted: the store itself and everything store-scoped.
    expect(await superuser.store.findUnique({ where: { id: storeId } })).toBeNull();
    expect(await superuser.product.findUnique({ where: { id: product.body.id } })).toBeNull();
    expect(await superuser.discountCode.findFirst({ where: { storeId } })).toBeNull();

    // Preserved: the seller's own account, subscription/billing history, audit trail.
    const survivingSeller = await superuser.seller.findUnique({ where: { id: seller.sellerId } });
    expect(survivingSeller).not.toBeNull();
    const survivingSubscription = await superuser.subscription.findUnique({ where: { sellerId: seller.sellerId } });
    expect(survivingSubscription).not.toBeNull();
    const survivingPayments = await superuser.walletTopUpRequest.findMany({ where: { ownerId: seller.sellerId } });
    expect(survivingPayments.length).toBeGreaterThan(0);

    const auditRow = await superuser.adminAuditLog.findFirst({ where: { action: "billing.store_retention_deleted", targetId: storeId } });
    expect(auditRow).not.toBeNull();
  });

  it("FR-6.41 race safety: a verified renewal payment that lands before the deletion sweep runs always wins - the store's data survives even though the retention window had elapsed", async () => {
    const adminToken = await createAndLoginAdmin("retain-admin4@example.com");
    const seller = await signup("retain-race@example.com");
    await payPlanFee(seller.token, adminToken);
    const storeRes = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Race Store", slug: "retain-race-store" });
    const storeId = storeRes.body.id as string;
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ title: "Saved Product", status: "active" });

    await pauseForNonPayment(seller.sellerId);
    // Back-date well past the retention window, exactly as the previous test does.
    await superuser.store.update({ where: { id: storeId }, data: { terminalPausedAt: new Date(Date.now() - 20 * DAY_MS) } });

    // The renewal payment lands - clears terminalPausedAt via restoreAfterPlanFeePayment() -
    // before the sweep ever runs.
    await payPlanFee(seller.token, adminToken);

    const retention = app.get(RetentionService);
    const result = await retention.runSweep(new Date());
    expect(result.deleted).toBe(0);

    const survivingStore = await superuser.store.findUnique({ where: { id: storeId } });
    expect(survivingStore).not.toBeNull();
    expect(survivingStore!.status).toBe("active");
    expect(survivingStore!.terminalPausedAt).toBeNull();
  });

  it("restoreAfterPlanFeePayment() clears every warning-sent flag along with terminalPausedAt, so a future pause cycle starts fresh", async () => {
    const adminToken = await createAndLoginAdmin("retain-admin5@example.com");
    const seller = await signup("retain-restore-clears@example.com");
    await payPlanFee(seller.token, adminToken);
    await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ name: "Clears Store", slug: "retain-restore-clears-store" });
    await pauseForNonPayment(seller.sellerId);

    const retention = app.get(RetentionService);
    const store = await superuser.store.findFirstOrThrow({ where: { sellerId: seller.sellerId } });
    await retention.runSweep(new Date(store.terminalPausedAt!.getTime() + 1000));
    const warned = await superuser.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(warned.retentionWarningDay0SentAt).not.toBeNull();

    const graceLadder = app.get(WalletGraceLadderService);
    await graceLadder.restoreAfterPlanFeePayment(seller.sellerId);

    const restored = await superuser.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(restored.terminalPausedAt).toBeNull();
    expect(restored.retentionWarningDay0SentAt).toBeNull();
  });
});
