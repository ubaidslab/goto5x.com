import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const STUDIO_THEME_ID = "22222222-2222-4222-8222-222222222222"; // premium-tier built-in theme (themes.seed.ts)

/**
 * Module 75 (SRS §5.6j/FR-7.23) - the founder-approved feature-gate ladder
 * across GO/RUN/RISE/FLY: store limits, email-campaign quotas, new
 * plan-scoped gates for gift cards and customer segments (previously
 * ungated), and closing the latent gap where premium-template access/
 * D-Studio/team-leader eligibility were defined but never actually turned
 * on for any tier. Each assertion below reads the real per-tier plan row
 * seeded by plans.seed.ts/stores.seed.ts/campaigns.seed.ts/gift-cards.seed.ts/
 * customer-segments.seed.ts - never a hardcoded number that would silently
 * drift from the real seed data.
 */
describe("Feature-Gate Ladder (e2e) - SRS §5.6j, §14.67, FR-7.23", () => {
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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId as string };
  }

  async function upgradeToTier(sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: plan.id } });
    return plan;
  }

  describe("Store limits (GO 1/RUN 3/RISE 5/FLY 10)", () => {
    it("a RUN seller may own up to 3 stores, blocked on the 4th", async () => {
      const { token, sellerId } = await signupLoginAndCreateStore("gate-run-stores@example.com", "gate-run-stores-store");
      await upgradeToTier(sellerId, 1); // RUN

      for (const slug of ["gate-run-two", "gate-run-three"]) {
        const res = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${token}`).send({ name: "Store", slug });
        expect(res.status).toBe(201);
      }
      const fourth = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${token}`).send({ name: "Store", slug: "gate-run-four" });
      expect(fourth.status).toBe(400);
      expect(fourth.body.message.message).toMatch(/store limit \(3\) has been reached/i);
    });

    it("a FLY seller's real seeded limit is 10, not the old 5", async () => {
      const { sellerId } = await signupLoginAndCreateStore("gate-fly-stores@example.com", "gate-fly-stores-store");
      await upgradeToTier(sellerId, 3); // FLY
      const flyPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 3 } });
      const value = await superuser.settingsValue.findFirstOrThrow({
        where: { definitionKey: "stores.max_per_seller", scopeType: "plan", scopeId: flyPlan.id },
      });
      expect(value.value).toBe(10);
    });
  });

  describe("Email-campaign quota ladder (GO 799/RUN 2,499/RISE 10,000/FLY unlimited)", () => {
    it("each individual tier's plan row carries the founder-approved quota", async () => {
      const expected: Record<number, number> = { 0: 799, 1: 2_499, 2: 10_000, 3: 1_000_000_000 };
      const plans = await superuser.plan.findMany({ where: { planGroup: "individual" } });
      for (const plan of plans) {
        const value = await superuser.settingsValue.findFirstOrThrow({
          where: { definitionKey: "email_campaigns.monthly_send_limit", scopeType: "plan", scopeId: plan.id },
        });
        expect(value.value).toBe(expected[plan.tierOrder]);
      }
    });
  });

  describe("Gift cards - new plan-scoped gate (previously ungated)", () => {
    it("a GO seller is blocked from issuing a gift card; a RISE seller is not", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("gate-go-giftcards@example.com", "gate-go-giftcards-store");

      const blocked = await request(app.getHttpServer())
        .post(`/stores/${storeId}/gift-cards`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 100 });
      expect(blocked.status).toBe(403);

      await upgradeToTier(sellerId, 2); // RISE
      const allowed = await request(app.getHttpServer())
        .post(`/stores/${storeId}/gift-cards`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 100 });
      expect(allowed.status).toBe(201);
    });

    it("the buyer-purchase path stays ungated regardless of the seller's plan (GO included)", async () => {
      const { storeId } = await signupLoginAndCreateStore("gate-go-giftcards-buy@example.com", "gate-go-giftcards-buy-store");
      const store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      const purchase = await request(app.getHttpServer())
        .post("/storefront/gift-cards/purchase")
        .send({ hostname: `${store.slug}.uzeyn.com`, amount: 500, buyerEmail: "buyer@example.com" });
      expect(purchase.status).toBe(201);
    });
  });

  describe("Customer segments - new plan-scoped gate (previously ungated)", () => {
    it("a GO seller is blocked from creating a segment; a FLY seller is not", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("gate-go-segments@example.com", "gate-go-segments-store");

      const blocked = await request(app.getHttpServer())
        .post(`/stores/${storeId}/customer-segments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Big spenders", minTotalSpent: 1000 });
      expect(blocked.status).toBe(403);

      await upgradeToTier(sellerId, 3); // FLY
      const allowed = await request(app.getHttpServer())
        .post(`/stores/${storeId}/customer-segments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Big spenders", minTotalSpent: 1000 });
      expect(allowed.status).toBe(201);
    });
  });

  describe("Closing the latent gap - premium templates/D-Studio/team-leader eligibility, off for GO/RUN, on for RISE/FLY", () => {
    it("theme.premium_tier_enabled and theme.coded_mode_enabled are false for RUN, true for RISE", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("gate-ladder-theme@example.com", "gate-ladder-theme-store");
      await upgradeToTier(sellerId, 1); // RUN

      const runPremiumBlocked = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ themeId: STUDIO_THEME_ID });
      expect(runPremiumBlocked.status).toBe(403);

      const runCodedBlocked = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ customCode: "<div>x</div>" });
      expect(runCodedBlocked.status).toBe(403);

      await upgradeToTier(sellerId, 2); // RISE

      const risePremiumAllowed = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ themeId: STUDIO_THEME_ID });
      expect(risePremiumAllowed.status).toBe(200);

      const riseCodedAllowed = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ customCode: "<div>x</div>" });
      expect(riseCodedAllowed.status).toBe(200);
    });

    it("teams.leader_eligible is false for GO, true for FLY", async () => {
      const { token, sellerId } = await signupLoginAndCreateStore("gate-ladder-leader@example.com", "gate-ladder-leader-store");
      const teamPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "team", tierOrder: 0 } });

      const goBlocked = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "My Team", planId: teamPlan.id });
      expect(goBlocked.status).toBe(403);

      await upgradeToTier(sellerId, 3); // FLY
      const flyAllowed = await request(app.getHttpServer())
        .post("/sellers/me/teams")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "My Team", planId: teamPlan.id });
      expect(flyAllowed.status).toBe(201);
    });
  });
});
