import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * New (v0.41, founder request) - "pause new subscriptions" mode: a
 * narrower, admin-controlled pause than platform.maintenance_mode_enabled
 * (which blocks EVERY request platform-wide). This blocks only what
 * actually creates a NEW subscription - a new seller's signup, and a
 * first-cycle (never-yet-paid) plan-fee submission - while an EXISTING
 * seller's dashboard, stores, and renewal payments continue completely
 * normally.
 */
describe("Pause new subscriptions mode (e2e) - v0.41 founder request", () => {
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

  async function setPaused(adminToken: string, paused: boolean, message?: string) {
    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "billing.new_subscriptions_paused", scopeType: "global", value: paused });
    if (message) {
      await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ key: "billing.new_subscriptions_paused_message", scopeType: "global", value: message });
    }
  }

  it("when off, signup and pricing-copy behave normally", async () => {
    const signup = await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email: "pns-normal@example.com", password: PASSWORD, businessName: "Normal Co" });
    expect(signup.status).toBe(201);

    const copy = await request(app.getHttpServer()).get("/plans/pricing-copy");
    expect(copy.body.newSubscriptionsPaused).toBe(false);
  });

  it("when on: blocks a new seller signup with the admin-editable message, and the pricing page reflects it", async () => {
    const adminToken = await createAndLoginAdmin("pns-admin1@example.com");
    await setPaused(adminToken, true, "Paused for a backlog.");

    const signup = await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email: "pns-blocked-seller@example.com", password: PASSWORD, businessName: "Blocked Co" });
    expect(signup.status).toBe(503);
    expect(signup.body.message.message).toBe("Paused for a backlog.");

    const created = await superuser.user.findUnique({ where: { email: "pns-blocked-seller@example.com" } });
    expect(created).toBeNull();

    const copy = await request(app.getHttpServer()).get("/plans/pricing-copy");
    expect(copy.body.newSubscriptionsPaused).toBe(true);
    expect(copy.body.newSubscriptionsPausedMessage).toBe("Paused for a backlog.");
  });

  it("when on: never blocks a supplier signup - the pause is scoped to sellers only", async () => {
    const adminToken = await createAndLoginAdmin("pns-admin2@example.com");
    await setPaused(adminToken, true);

    const signup = await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ email: "pns-supplier@example.com", password: PASSWORD, businessName: "Supplier Co", role: "supplier" });
    expect(signup.status).toBe(201);
  });

  it("when on: blocks a first-cycle (never-yet-paid) plan-fee submission, even for a seller who signed up before the pause", async () => {
    const adminToken = await createAndLoginAdmin("pns-admin3@example.com");
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email: "pns-preexisting@example.com", password: PASSWORD, businessName: "Preexisting Co" });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email: "pns-preexisting@example.com", password: PASSWORD });
    const token = login.body.accessToken as string;

    await setPaused(adminToken, true, "No new subscriptions right now.");

    const submit = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(submit.status).toBe(400);
    expect(submit.body.message.message).toBe("No new subscriptions right now.");
  });

  it("when on: an EXISTING seller (already verified one plan-fee payment) can still submit a renewal - completely unaffected", async () => {
    const adminToken = await createAndLoginAdmin("pns-admin4@example.com");
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email: "pns-renewing@example.com", password: PASSWORD, businessName: "Renewing Co" });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email: "pns-renewing@example.com", password: PASSWORD });
    const token = login.body.accessToken as string;

    // First (real) payment, verified while unpaused - establishes "isRenewal" history.
    const first = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(first.status).toBe(201);
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${first.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Now pause new subscriptions.
    await setPaused(adminToken, true, "No new subscriptions right now.");

    // This seller's next payment is a renewal - must succeed regardless.
    const renewal = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(renewal.status).toBe(201);
    expect(renewal.body.isRenewal).toBe(true);
  });
});
