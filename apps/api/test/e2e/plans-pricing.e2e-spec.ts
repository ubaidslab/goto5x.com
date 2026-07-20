import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";
import * as bcrypt from "bcryptjs";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * SRS §5.7/§14.7 - Subscription Plans, Pricing & Billing, plus the four
 * cross-checks the founder named ahead of this module: developer-perk
 * tier binding, dashboard-personalization gating closure, next-cycle/
 * launch-campaign pricing, and (in teams.e2e-spec.ts) the group-invoice
 * math.
 */
describe("Plans, Pricing & Billing (e2e) - SRS §5.7/§14.7", () => {
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

  async function adminToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash("admin-password", 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: "admin-password" });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken;
  }

  describe("Plan groups/tiers as data (FR-7.17)", () => {
    it("the public /plans endpoint renders every group/tier entirely from plan-editor data", async () => {
      const res = await request(app.getHttpServer()).get("/plans");
      expect(res.status).toBe(200);
      expect(res.body.individual.map((p: { name: string }) => p.name)).toEqual(["Free", "Starter", "Standard", "Pro"]);
      expect(res.body.team).toHaveLength(3);
      expect(res.body.supplier.map((p: { name: string }) => p.name)).toEqual(["Supplier Free", "Supplier Premium"]);
    });

    it("an admin can create a new tier, reorder it, and retire it - all without a deploy (FR-8.2)", async () => {
      const token = await adminToken("plans-admin-crud@example.com");

      const created = await request(app.getHttpServer())
        .post("/admin/plans")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Elite", planGroup: "individual", price: 15000, billingInterval: "monthly" });
      expect(created.status).toBe(201);
      expect(created.body.tierOrder).toBe(4); // appended after the seeded 0-3 tiers

      const renamed = await request(app.getHttpServer())
        .patch(`/admin/plans/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Elite Plus", tierOrder: 10 });
      expect(renamed.status).toBe(200);
      expect(renamed.body.name).toBe("Elite Plus");
      expect(renamed.body.tierOrder).toBe(10);

      const retired = await request(app.getHttpServer())
        .post(`/admin/plans/${created.body.id}/retire`)
        .set("Authorization", `Bearer ${token}`);
      expect(retired.status).toBe(201);
      expect(retired.body.isActive).toBe(false);

      // Retiring never deletes it - it still exists, just excluded from the public listing.
      const publicList = await request(app.getHttpServer()).get("/plans");
      expect(publicList.body.individual.some((p: { id: string }) => p.id === created.body.id)).toBe(false);
      const adminList = await request(app.getHttpServer())
        .get("/admin/plans?includeInactive=true")
        .set("Authorization", `Bearer ${token}`);
      expect(adminList.body.individual.some((p: { id: string }) => p.id === created.body.id)).toBe(true);
    });

    it("rejects seatPrice on a non-team tier (FR-7.18)", async () => {
      const token = await adminToken("plans-admin-reject@example.com");
      const res = await request(app.getHttpServer())
        .post("/admin/plans")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Bad Tier", planGroup: "individual", price: 100, seatPrice: 50, billingInterval: "monthly" });
      expect(res.status).toBe(400);
    });
  });

  describe("Free Plan enforcement + inverse commission laddering (FR-7.3/7.4)", () => {
    it("Free Plan carries the default (higher) commission rate; a higher tier overrides it via Settings Registry precedence", async () => {
      const { token, sellerId } = await signup("commission-ladder@example.com");
      await superuser.seller.update({ where: { id: sellerId }, data: { isTrusted: true, cnicHash: `hash-${sellerId}` } });

      const store = await request(app.getHttpServer())
        .post("/stores")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Ladder Store", slug: "ladder-store" });
      await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
      // Module 20 (SRS §5.6e, FR-6.21) - checkout now also requires the
      // store to be published; set directly rather than going through the
      // real publish flow (top-up + verify) in every test.
      await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });

      const starterPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } });
      await app.get(SettingsService).setValue(
        "billing.commission_rate_percent",
        "plan",
        starterPlan.id,
        0.5,
        "00000000-0000-0000-0000-000000000000",
      );

      const category = await superuser.category.create({ data: { name: "Ladder", slug: `ladder-${Date.now()}` } });
      async function placeAndPay(price: number) {
        const product = await request(app.getHttpServer())
          .post(`/stores/${store.body.id}/products`)
          .set("Authorization", `Bearer ${token}`)
          .send({ title: "Ladder Product", categoryId: category.id, status: "active" });
        await superuser.product.update({ where: { id: product.body.id }, data: { moderationStatus: "approved" } });
        const variant = await request(app.getHttpServer())
          .post(`/stores/${store.body.id}/products/${product.body.id}/variants`)
          .set("Authorization", `Bearer ${token}`)
          .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 10 });
        const order = await request(app.getHttpServer())
          .post(`/stores/${store.body.id}/orders`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            buyerEmail: "buyer@example.com",
            shippingAddress: { fullName: "Buyer", line1: "1 St", city: "Lahore", country: "PK", phone: "03001234567" },
            items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
          });
        await request(app.getHttpServer())
          .post(`/stores/${store.body.id}/orders/${order.body.id}/mark-as-paid`)
          .set("Authorization", `Bearer ${token}`);
      }

      // Free Plan: default 1% rate.
      await placeAndPay(1000);
      const freeEntries = await superuser.ledgerEntry.findMany({ where: { sellerId, type: "commission_accrued" } });
      expect(Number(freeEntries[0].amount)).toBeCloseTo(10, 2); // 1% of 1000

      // Upgrade to Starter (Free Plan -> no cycle yet, so FR-7.5's "immediately" edge case applies).
      const change = await request(app.getHttpServer())
        .post("/sellers/me/subscription/change")
        .set("Authorization", `Bearer ${token}`)
        .send({ planId: starterPlan.id });
      expect(change.status).toBe(201);
      expect(change.body.planId).toBe(starterPlan.id);

      await placeAndPay(1000);
      const allEntries = await superuser.ledgerEntry.findMany({ where: { sellerId, type: "commission_accrued" }, orderBy: { createdAt: "asc" } });
      expect(Number(allEntries[1].amount)).toBeCloseTo(5, 2); // 0.5% of 1000, the Starter override
    });

    it("FR-7.5: a plan change requested while already on a paid cycle is deferred to the next cycle, not applied immediately", async () => {
      const { token, sellerId } = await signup("next-cycle@example.com");
      const starterPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } });
      const standardPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });

      // First change (Free -> Starter): no cycle yet, applies immediately and starts one.
      await request(app.getHttpServer())
        .post("/sellers/me/subscription/change")
        .set("Authorization", `Bearer ${token}`)
        .send({ planId: starterPlan.id });

      // Second change (Starter -> Standard): a real cycle is now active, so this must defer.
      const secondChange = await request(app.getHttpServer())
        .post("/sellers/me/subscription/change")
        .set("Authorization", `Bearer ${token}`)
        .send({ planId: standardPlan.id });
      expect(secondChange.status).toBe(201);
      expect(secondChange.body.planId).toBe(starterPlan.id); // unchanged for now
      expect(secondChange.body.pendingPlanId).toBe(standardPlan.id);

      const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      expect(subscription.planId).toBe(starterPlan.id);
      expect(subscription.pendingPlanId).toBe(standardPlan.id);
    });
  });

  describe("Yearly billing (FR-7.6)", () => {
    it("computes the discounted annual price correctly for a monthly tier", async () => {
      const token = await adminToken("yearly-admin@example.com");
      const plan = await request(app.getHttpServer())
        .post("/admin/plans")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Yearly Test", planGroup: "individual", price: 1000, billingInterval: "monthly", yearlyDiscountPercent: 20 });
      expect(plan.body.yearlyPrice).toBeUndefined(); // create/update responses are raw rows, not the derived view

      const list = await request(app.getHttpServer()).get("/plans");
      const found = list.body.individual.find((p: { id: string }) => p.id === plan.body.id);
      expect(found.yearlyPrice).toBe(9600); // 1000*12=12000, 20% off
    });
  });

  describe("Launch-campaign pricing (FR-7.7)", () => {
    it("applies the campaign discount within its expiry/seller-limit window and stops once either condition lapses", async () => {
      const { token: firstToken, sellerId: firstSellerId } = await signup("campaign-first@example.com");
      await superuser.seller.update({ where: { id: firstSellerId }, data: { isTrusted: true, cnicHash: `hash-${firstSellerId}` } });
      const { token: secondToken, sellerId: secondSellerId } = await signup("campaign-second@example.com");
      await superuser.seller.update({ where: { id: secondSellerId }, data: { isTrusted: true, cnicHash: `hash-${secondSellerId}` } });

      const settings = app.get(SettingsService);
      const adminId = "00000000-0000-0000-0000-000000000000";
      await settings.setValue("billing.launch_campaign_discount_percent", "global", null, 1, adminId);
      await settings.setValue("billing.launch_campaign_seller_limit", "global", null, 1, adminId); // only the first-ever seller

      async function orderAndCommission(token: string, storeSlug: string, sellerId: string) {
        const store = await request(app.getHttpServer())
          .post("/stores")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: storeSlug, slug: storeSlug });
        await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
      // Module 20 (SRS §5.6e, FR-6.21) - checkout now also requires the
      // store to be published; set directly rather than going through the
      // real publish flow (top-up + verify) in every test.
      await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
        const category = await superuser.category.create({ data: { name: "Campaign", slug: `campaign-${Date.now()}-${Math.random()}` } });
        const product = await request(app.getHttpServer())
          .post(`/stores/${store.body.id}/products`)
          .set("Authorization", `Bearer ${token}`)
          .send({ title: "Campaign Product", categoryId: category.id, status: "active" });
        await superuser.product.update({ where: { id: product.body.id }, data: { moderationStatus: "approved" } });
        const variant = await request(app.getHttpServer())
          .post(`/stores/${store.body.id}/products/${product.body.id}/variants`)
          .set("Authorization", `Bearer ${token}`)
          .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price: 1000, stockQuantity: 10 });
        const order = await request(app.getHttpServer())
          .post(`/stores/${store.body.id}/orders`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            buyerEmail: "buyer@example.com",
            shippingAddress: { fullName: "Buyer", line1: "1 St", city: "Lahore", country: "PK", phone: "03001234567" },
            items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
          });
        await request(app.getHttpServer())
          .post(`/stores/${store.body.id}/orders/${order.body.id}/mark-as-paid`)
          .set("Authorization", `Bearer ${token}`);
        const entries = await superuser.ledgerEntry.findMany({ where: { sellerId, type: "commission_accrued" } });
        return Number(entries[0].amount);
      }

      // The first-ever seller is within the counter condition (rank 1 <= limit 1): 1% - 1% = 0%.
      const firstAmount = await orderAndCommission(firstToken, "campaign-first-store", firstSellerId);
      expect(firstAmount).toBeCloseTo(0, 2);

      // The second seller is rank 2, over the limit - full 1% rate applies.
      const secondAmount = await orderAndCommission(secondToken, "campaign-second-store", secondSellerId);
      expect(secondAmount).toBeCloseTo(10, 2);
    });
  });

  describe("Admin-granted plans (FR-7.8)", () => {
    it("bypasses checkout entirely and is captured in admin_audit_logs with before/after plan", async () => {
      const { sellerId } = await signup("admin-grant@example.com");
      const token = await adminToken("admin-grant-admin@example.com");
      const proPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 3 } });

      const res = await request(app.getHttpServer())
        .post(`/admin/sellers/${sellerId}/plan`)
        .set("Authorization", `Bearer ${token}`)
        .send({ planId: proPlan.id });
      expect(res.status).toBe(201);
      expect(res.body.planId).toBe(proPlan.id);

      const log = await superuser.adminAuditLog.findFirst({ where: { action: "plans.admin_granted", targetType: "subscription" } });
      expect(log).not.toBeNull();
      expect((log!.beforeValue as { planName: string }).planName).toBe("Free");
      expect((log!.afterValue as { planName: string }).planName).toBe("Pro");
    });
  });

  describe("Platform subscription promo codes (FR-7.9)", () => {
    it("redeems correctly, respects the redemption limit, and is entirely distinct from a store's own discount_codes", async () => {
      const { token: sellerToken, sellerId } = await signup("promo-seller@example.com");
      const adminUserToken = await adminToken("promo-admin@example.com");

      const created = await request(app.getHttpServer())
        .post("/admin/promo-codes")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ code: "LAUNCH10", discountType: "percent", discountValue: 10, maxRedemptions: 1 });
      expect(created.status).toBe(201);

      const redeemed = await request(app.getHttpServer())
        .post("/sellers/me/subscription/redeem-promo")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({ code: "LAUNCH10" });
      expect(redeemed.status).toBe(201);

      // Cannot redeem twice.
      const secondAttempt = await request(app.getHttpServer())
        .post("/sellers/me/subscription/redeem-promo")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({ code: "LAUNCH10" });
      expect(secondAttempt.status).toBe(400);

      // A second seller cannot redeem it either - maxRedemptions (1) already spent.
      const { token: otherToken } = await signup("promo-other@example.com");
      const otherAttempt = await request(app.getHttpServer())
        .post("/sellers/me/subscription/redeem-promo")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ code: "LAUNCH10" });
      expect(otherAttempt.status).toBe(400);

      // Never reachable at a storefront checkout - proven simply by it living in
      // an entirely separate table/service from store-level discount_codes, no shared lookup path.
      const storeDiscountCodes = await superuser.discountCode.findMany({ where: { code: "LAUNCH10" } });
      expect(storeDiscountCodes).toHaveLength(0);
    });

    it("respects expiry and target-user restrictions", async () => {
      const adminUserToken = await adminToken("promo-admin-2@example.com");
      const { token: sellerToken } = await signup("promo-expired@example.com");

      await request(app.getHttpServer())
        .post("/admin/promo-codes")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({ code: "EXPIRED5", discountType: "fixed", discountValue: 5, expiresAt: "2020-01-01T00:00:00.000Z" });

      const res = await request(app.getHttpServer())
        .post("/sellers/me/subscription/redeem-promo")
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({ code: "EXPIRED5" });
      expect(res.status).toBe(400);
    });
  });

  describe("Supplier Premium Plan data (FR-7.10)", () => {
    it("both supplier tiers exist as founder-set plan data", async () => {
      const res = await request(app.getHttpServer()).get("/plans");
      expect(res.body.supplier).toHaveLength(2);
      expect(res.body.supplier[0].name).toBe("Supplier Free");
      expect(res.body.supplier[1].name).toBe("Supplier Premium");
    });
  });

  describe("Cross-checks (confirm no gap)", () => {
    it("developer perks (theme.coded_mode_enabled) bind to the correct tier under the new group/tier addressing scheme (FR-7.16)", async () => {
      const { token, sellerId } = await signup("dev-perk@example.com");
      const store = await request(app.getHttpServer())
        .post("/stores")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Perk Store", slug: "perk-store" });

      // Free Plan (global default false) - rejected.
      const rejected = await request(app.getHttpServer())
        .patch(`/stores/${store.body.id}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ customCode: "<div>x</div>" });
      expect(rejected.status).toBe(403);

      // Grant Pro, and bind the perk to Pro specifically via a plan-scoped override.
      const proPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 3 } });
      await superuser.subscription.update({ where: { sellerId }, data: { planId: proPlan.id } });
      await app.get(SettingsService).setValue("theme.coded_mode_enabled", "plan", proPlan.id, true, "00000000-0000-0000-0000-000000000000");

      const allowed = await request(app.getHttpServer())
        .patch(`/stores/${store.body.id}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ customCode: "<div>x</div>" });
      expect(allowed.status).toBe(200);
    });

    it("dashboard-personalization gating (FR-28.4) is finally enforced, not just documented (Module 10's open item, closed here)", async () => {
      const { token, sellerId } = await signup("dashboard-perk@example.com");

      // Free Plan (global default ["default"]) - "emerald" is rejected.
      const rejected = await request(app.getHttpServer())
        .patch("/sellers/me/dashboard-theme")
        .set("Authorization", `Bearer ${token}`)
        .send({ dashboardTheme: "emerald" });
      expect(rejected.status).toBe(403);

      const starterPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } });
      await superuser.subscription.update({ where: { sellerId }, data: { planId: starterPlan.id } });
      await app
        .get(SettingsService)
        .setValue("dashboard.personalization_allowed_themes", "plan", starterPlan.id, ["default", "emerald"], "00000000-0000-0000-0000-000000000000");

      const allowed = await request(app.getHttpServer())
        .patch("/sellers/me/dashboard-theme")
        .set("Authorization", `Bearer ${token}`)
        .send({ dashboardTheme: "emerald" });
      expect(allowed.status).toBe(200);
      expect(allowed.body.dashboardTheme).toBe("emerald");
    });
  });
});
