import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

const shippingAddress = {
  fullName: "Ayesha Khan",
  line1: "House 12, Street 3",
  city: "Lahore",
  country: "PK",
  phone: "03001234567",
};

/**
 * SRS §5.8/§5.12 (Admin Control Plane completion), FR-8.4/8.10/8.15/12.1/12.3,
 * §14.8. Covers: content pages + brand assets (FR-12.1/12.3), in-app
 * messaging + maintenance mode (FR-8.15/8.7), real-time analytics (FR-8.10),
 * and seller impersonation + the v0.23 impersonation-transparency
 * amendment (FR-8.4). Module 6's own moderation-queue API is already
 * covered by moderation.e2e-spec.ts - this file only adds its admin-UI
 * reachability where relevant.
 */
describe("Admin Control Plane completion (e2e) - SRS §5.8/§5.12, FR-8.4/8.10/8.15/12.1/12.3, §14.8", () => {
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
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    await superuser.seller.update({
      where: { userId: user.id },
      data: { isTrusted: true, cnicHash: `test-cnic-hash-${user.id}` },
    });
    await superuser.storePaymentInstructions.update({
      where: { storeId: store.body.id },
      data: { codEnabled: true },
    });
    // Module 20 (SRS §5.6e, FR-6.21) - checkout now also requires the store
    // to be published; set directly rather than every test going through
    // the real publish flow (top-up + verify).
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, userId: user.id, sellerId: seller.id };
  }

  async function createAndLoginAdmin(email: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });

    const login = await request(app.getHttpServer())
      .post("/admin/auth/login")
      .send({ email, password: ADMIN_PASSWORD });
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

  describe("Content pages + brand assets (FR-12.1/12.3)", () => {
    it("an admin write creates a new version and revision history; a public read needs no auth", async () => {
      const adminToken = await createAndLoginAdmin("cp-admin@example.com");

      const v1 = await request(app.getHttpServer())
        .put("/admin/content-pages/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Terms of Service", bodyHtml: "<p>v1</p>" });
      expect(v1.status).toBe(200);
      expect(v1.body.currentVersion).toBe(1);

      const v2 = await request(app.getHttpServer())
        .put("/admin/content-pages/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ title: "Terms of Service", bodyHtml: "<p>v2</p>" });
      expect(v2.body.currentVersion).toBe(2);

      const revisions = await request(app.getHttpServer())
        .get("/admin/content-pages/terms/revisions")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(revisions.body).toHaveLength(2);

      const publicRead = await request(app.getHttpServer()).get("/content-pages/terms");
      expect(publicRead.status).toBe(200);
      expect(publicRead.body.bodyHtml).toBe("<p>v2</p>");
    });

    it("a brand asset write is versioned and publicly readable", async () => {
      const adminToken = await createAndLoginAdmin("ba-admin@example.com");
      const write = await request(app.getHttpServer())
        .put("/admin/brand-assets/logo")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ url: "https://uzeyn.com/logo-v1.png" });
      expect(write.body.currentVersion).toBe(1);

      const publicRead = await request(app.getHttpServer()).get("/brand-assets/logo");
      expect(publicRead.body.url).toBe("https://uzeyn.com/logo-v1.png");
    });
  });

  describe("In-app messaging + maintenance mode (FR-8.15/FR-8.7)", () => {
    it("a message targeted 'all' is visible to any seller; one targeted at a specific seller is visible only to them", async () => {
      const adminToken = await createAndLoginAdmin("msg-admin@example.com");
      const a = await signupLoginAndCreateStore("msg-seller-a@example.com", "msg-seller-a-store");
      const b = await signupLoginAndCreateStore("msg-seller-b@example.com", "msg-seller-b-store");

      await request(app.getHttpServer())
        .post("/admin/messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ channel: "banner", targetType: "all", body: "Platform-wide banner" });
      await request(app.getHttpServer())
        .post("/admin/messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ channel: "popup", targetType: "seller", targetSellerId: a.sellerId, body: "Just for seller A" });

      const forA = await request(app.getHttpServer())
        .get("/sellers/me/messages")
        .set("Authorization", `Bearer ${a.token}`);
      expect(forA.body).toHaveLength(2);

      const forB = await request(app.getHttpServer())
        .get("/sellers/me/messages")
        .set("Authorization", `Bearer ${b.token}`);
      expect(forB.body).toHaveLength(1);
      expect(forB.body[0].channel).toBe("banner");
    });

    it("a message scheduled in the future is not yet visible", async () => {
      const adminToken = await createAndLoginAdmin("msg-sched-admin@example.com");
      const seller = await signupLoginAndCreateStore("msg-sched-seller@example.com", "msg-sched-seller-store");

      await request(app.getHttpServer())
        .post("/admin/messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          channel: "banner",
          targetType: "all",
          body: "Not yet",
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

      const messages = await request(app.getHttpServer())
        .get("/sellers/me/messages")
        .set("Authorization", `Bearer ${seller.token}`);
      expect(messages.body).toHaveLength(0);
    });

    it("a message whose end window has already passed is no longer visible", async () => {
      const adminToken = await createAndLoginAdmin("msg-ended-admin@example.com");
      const seller = await signupLoginAndCreateStore("msg-ended-seller@example.com", "msg-ended-seller-store");

      await request(app.getHttpServer())
        .post("/admin/messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          channel: "banner",
          targetType: "all",
          body: "Already over",
          endsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        });

      const messages = await request(app.getHttpServer())
        .get("/sellers/me/messages")
        .set("Authorization", `Bearer ${seller.token}`);
      expect(messages.body).toHaveLength(0);
    });

    it("a message targeted at a specific plan is visible only to sellers on that plan", async () => {
      const adminToken = await createAndLoginAdmin("msg-plan-admin@example.com");
      const onPlan = await signupLoginAndCreateStore("msg-plan-seller-a@example.com", "msg-plan-seller-a-store");
      const offPlan = await signupLoginAndCreateStore("msg-plan-seller-b@example.com", "msg-plan-seller-b-store");

      // Every seller starts on the entry tier at signup (FR-7.1/7.3) - not
      // this test's focus, so move the second seller to a different tier
      // directly rather than exercising the real upgrade flow. Looked up
      // by tierOrder, never by name (this tier has already been renamed
      // twice).
      const differentTierPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 1 } });
      await superuser.subscription.update({ where: { sellerId: offPlan.sellerId }, data: { planId: differentTierPlan.id } });

      const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId: onPlan.sellerId } });

      await request(app.getHttpServer())
        .post("/admin/messages")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ channel: "banner", targetType: "plan", targetPlanId: subscription.planId, body: "For your plan" });

      const forOnPlan = await request(app.getHttpServer())
        .get("/sellers/me/messages")
        .set("Authorization", `Bearer ${onPlan.token}`);
      expect(forOnPlan.body).toHaveLength(1);

      const forOffPlan = await request(app.getHttpServer())
        .get("/sellers/me/messages")
        .set("Authorization", `Bearer ${offPlan.token}`);
      expect(forOffPlan.body).toHaveLength(0);
    });

    it("enabling maintenance mode blocks a non-allowlisted request but an allowlisted IP still gets through, including to the admin terminal (FR-8.7)", async () => {
      const settingsService = app.get(SettingsService);

      const blocked = await request(app.getHttpServer()).get("/content-pages");
      expect(blocked.status).not.toBe(503);

      await settingsService.setValue(
        "platform.maintenance_mode_enabled",
        "global",
        null,
        true,
        "00000000-0000-0000-0000-000000000000",
      );

      const duringMaintenance = await request(app.getHttpServer()).get("/content-pages");
      expect(duringMaintenance.status).toBe(503);

      // /health is excluded from the gate even with no allowlist set at all -
      // an infra liveness probe, not a buyer/seller/admin surface.
      const healthDuringMaintenance = await request(app.getHttpServer()).get("/health");
      expect(healthDuringMaintenance.status).not.toBe(503);

      await settingsService.setValue(
        "platform.maintenance_admin_ip_allowlist",
        "global",
        null,
        ["127.0.0.1", "::1", "::ffff:127.0.0.1"],
        "00000000-0000-0000-0000-000000000000",
      );

      const allowlisted = await request(app.getHttpServer()).get("/content-pages");
      expect(allowlisted.status).not.toBe(503);
    });
  });

  describe("Real-time analytics (FR-8.10)", () => {
    it("GMV/revenue excludes a deliberately-constructed unpaid order (Financial Truth Invariant, §3.12)", async () => {
      const adminToken = await createAndLoginAdmin("analytics-admin@example.com");
      const seller = await signupLoginAndCreateStore("analytics-seller@example.com", "analytics-seller-store");

      const product = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/products`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ title: "Widget", status: "active" });
      const variant = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ sku: `SKU-${Date.now()}`, price: 5000, stockQuantity: 100 });

      const paidOrder = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/orders`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({
          buyerEmail: "buyer@example.com",
          shippingAddress,
          items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
        });
      await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/orders/${paidOrder.body.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${seller.token}`);

      // Deliberately left pending (never marked paid) - must not count.
      await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/orders`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({
          buyerEmail: "buyer2@example.com",
          shippingAddress,
          items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 10 }],
        });

      const analytics = await request(app.getHttpServer())
        .get("/admin/analytics")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(analytics.body.gmv).toBe(5000);
    });
  });

  describe("Seller impersonation + view-any-store, incl. v0.23 transparency amendment (FR-8.4)", () => {
    it("starting a session emits a platform_event and creates an audit-log row; the token is scoped to the seller and blocked from high-risk writes", async () => {
      const adminToken = await createAndLoginAdmin("imp-admin@example.com");
      const seller = await signupLoginAndCreateStore("imp-seller@example.com", "imp-seller-store");

      const start = await request(app.getHttpServer())
        .post(`/admin/sellers/${seller.sellerId}/impersonate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Investigating a support ticket" });
      expect(start.status).toBe(201);
      const impersonationToken = start.body.accessToken as string;
      const sessionId = start.body.impersonationSessionId as string;

      const event = await superuser.platformEvent.findFirst({ where: { eventType: "admin.impersonation.started" } });
      expect(event).not.toBeNull();
      expect(event!.entityId).toBe(seller.sellerId);

      const startAudit = await superuser.adminAuditLog.findFirst({ where: { action: "impersonation.start" } });
      expect(startAudit).not.toBeNull();
      expect(startAudit!.impersonationSessionId).toBe(sessionId);

      // The impersonation token behaves as a normal seller session for reads.
      const ordinaryRead = await request(app.getHttpServer())
        .get(`/stores/${seller.storeId}`)
        .set("Authorization", `Bearer ${impersonationToken}`);
      expect(ordinaryRead.status).toBe(200);

      // But every action under it gets tagged in the audit log (generic interceptor).
      const actionAudit = await superuser.adminAuditLog.findFirst({
        where: { impersonationSessionId: sessionId, targetType: "impersonation_action" },
      });
      expect(actionAudit).not.toBeNull();

      // High-risk writes are blocked outright.
      const product = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/products`)
        .set("Authorization", `Bearer ${impersonationToken}`)
        .send({ title: "Widget", status: "active" });
      const variant = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${impersonationToken}`)
        .send({ sku: `SKU-${Date.now()}`, price: 1000, stockQuantity: 10 });
      const order = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/orders`)
        .set("Authorization", `Bearer ${impersonationToken}`)
        .send({
          buyerEmail: "blocked-buyer@example.com",
          shippingAddress,
          items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
        });
      const blockedMarkPaid = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/orders/${order.body.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${impersonationToken}`);
      expect(blockedMarkPaid.status).toBe(403);

      const blockedPaymentInstructions = await request(app.getHttpServer())
        .patch(`/stores/${seller.storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${impersonationToken}`)
        .send({ codEnabled: false });
      expect(blockedPaymentInstructions.status).toBe(403);

      // Ordinary write (not on the blocked list) still succeeds during impersonation.
      expect(order.status).toBe(201);

      // Admin ends the session from their own token; ending is itself logged.
      const end = await request(app.getHttpServer())
        .post(`/admin/impersonation/${sessionId}/end`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(end.status).toBe(201);
      const endAudit = await superuser.adminAuditLog.findFirst({ where: { action: "impersonation.end" } });
      expect(endAudit).not.toBeNull();

      // The seller's own Security-card read shows when/duration, never the admin's identity.
      const history = await request(app.getHttpServer())
        .get("/sellers/me/support-access-history")
        .set("Authorization", `Bearer ${seller.token}`);
      expect(history.status).toBe(200);
      expect(history.body).toHaveLength(1);
      expect(history.body[0]).toHaveProperty("startedAt");
      expect(history.body[0]).toHaveProperty("durationMinutes");
      expect(history.body[0]).not.toHaveProperty("adminUserId");
    });

    it("read-only view-any-store access works regardless of who owns the store", async () => {
      const adminToken = await createAndLoginAdmin("view-store-admin@example.com");
      const seller = await signupLoginAndCreateStore("view-store-seller@example.com", "view-store-seller-store");

      const view = await request(app.getHttpServer())
        .get(`/admin/stores/${seller.storeId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(view.status).toBe(200);
      expect(view.body.id).toBe(seller.storeId);
    });
  });
});
