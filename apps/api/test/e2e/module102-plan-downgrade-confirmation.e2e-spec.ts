import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const STAFF_PASSWORD = "staff-horse-battery-9";

/**
 * FR-6.69 (Module 102) - "what would this seller actually lose" before a
 * downgrade applies: an informational, overridable feature-loss warning
 * (never a silent downgrade), composed alongside (not replacing) Module
 * 66/FR-6.43's pre-existing, mandatory store-choice gate.
 */
describe("Plan-downgrade confirmation (e2e) - SRS §5.6/§14.70 (Module 102, FR-6.69)", () => {
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

  async function createStore(token: string, slug: string) {
    const res = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${token}`).send({ name: "Store", slug });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function grantPlan(adminToken: string, sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
    const res = await request(app.getHttpServer())
      .post(`/admin/sellers/${sellerId}/plan`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ planId: plan.id });
    expect(res.status).toBe(201);
    return plan;
  }

  async function createStaff(ownerToken: string, email: string) {
    await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email, password: STAFF_PASSWORD, scopePermissions: [{ scope: "orders", permission: "write" }] });
  }

  it("a downgrade with real feature losses returns requiresDowngradeConfirmation instead of applying anything", async () => {
    const adminToken = await createAndLoginAdmin("downconf-admin1@example.com");
    const seller = await signup("downconf-losses@example.com");
    await createStore(seller.token, "downconf-losses-store");
    await grantPlan(adminToken, seller.sellerId, 3); // FLY

    const runPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } }); // RUN
    const change = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: runPlan.id });

    expect(change.status).toBe(201);
    expect(change.body.requiresDowngradeConfirmation).toBe(true);
    expect(change.body.losses).toEqual(
      expect.arrayContaining([
        { label: "Wishlist / save-for-later", detail: "No longer included on this plan." },
        { label: "Live chat widget", detail: "No longer included on this plan." },
      ]),
    );

    // Nothing staged - the seller is still on FLY, no pendingPlanId.
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: seller.sellerId } });
    expect(subscription.pendingPlanId).toBeNull();
  });

  it("resubmitting with confirmed:true proceeds past the warning", async () => {
    const adminToken = await createAndLoginAdmin("downconf-admin2@example.com");
    const seller = await signup("downconf-confirmed@example.com");
    await createStore(seller.token, "downconf-confirmed-store");
    await grantPlan(adminToken, seller.sellerId, 3); // FLY

    const runPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } }); // RUN
    const first = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: runPlan.id });
    expect(first.body.requiresDowngradeConfirmation).toBe(true);

    const confirmed = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: runPlan.id, confirmed: true });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.requiresDowngradeConfirmation).toBeUndefined();
    expect(confirmed.body.pendingPlanId).toBe(runPlan.id);
  });

  it("a downgrade with zero actual losses applies with no confirmation step at all", async () => {
    const adminToken = await createAndLoginAdmin("downconf-admin3@example.com");
    const seller = await signup("downconf-nolosses@example.com");
    await createStore(seller.token, "downconf-nolosses-store");
    await grantPlan(adminToken, seller.sellerId, 1); // RUN - no active gate flips true below RUN, and 0 staff accounts

    const goPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } }); // GO
    const change = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: goPlan.id });

    expect(change.status).toBe(201);
    expect(change.body.requiresDowngradeConfirmation).toBeUndefined();
    expect(change.body.requiresStoreChoice).toBeUndefined();
    expect(change.body.pendingPlanId).toBe(goPlan.id);
  });

  it("compares the seller's live active staff count against the candidate plan's limit, not just the plan's own default", async () => {
    const adminToken = await createAndLoginAdmin("downconf-admin4@example.com");
    const seller = await signup("downconf-staff@example.com");
    await createStore(seller.token, "downconf-staff-store");
    await grantPlan(adminToken, seller.sellerId, 3); // FLY (staff.max_accounts = 5)
    for (let i = 0; i < 4; i += 1) {
      await createStaff(seller.token, `downconf-staff-hire-${i}@example.com`);
    }

    const risePlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } }); // RISE (limit 3)
    const change = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: risePlan.id });

    expect(change.status).toBe(201);
    expect(change.body.requiresDowngradeConfirmation).toBe(true);
    expect(change.body.losses).toEqual(
      expect.arrayContaining([
        { label: "Staff seats", detail: "You have 4 active staff accounts; this plan allows only 3." },
      ]),
    );
  });

  it("composes with FR-6.43's store-choice gate: feature-loss confirmation first, store choice second, both required in order", async () => {
    const adminToken = await createAndLoginAdmin("downconf-admin5@example.com");
    const seller = await signup("downconf-compose@example.com");
    const store1 = await createStore(seller.token, "downconf-compose-1");
    await grantPlan(adminToken, seller.sellerId, 3); // FLY (max stores 10)
    await createStore(seller.token, "downconf-compose-2");

    const goPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } }); // GO (max stores 1)

    // Step 1: unconfirmed - the feature-loss warning fires first, before the
    // store-choice gate is even evaluated.
    const first = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: goPlan.id });
    expect(first.body.requiresDowngradeConfirmation).toBe(true);
    expect(first.body.requiresStoreChoice).toBeUndefined();

    // Step 2: confirmed, but still no store choice - Module 66's mandatory
    // gate fires next.
    const second = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: goPlan.id, confirmed: true });
    expect(second.body.requiresDowngradeConfirmation).toBeUndefined();
    expect(second.body.requiresStoreChoice).toBe(true);
    expect(second.body.maxStores).toBe(1);
    expect(second.body.activeStores).toHaveLength(2);

    // Step 3: both satisfied - the change finally stages.
    const third = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ planId: goPlan.id, confirmed: true, keepStoreIds: [store1] });
    expect(third.status).toBe(201);
    expect(third.body.pendingPlanId).toBe(goPlan.id);
  });
});
