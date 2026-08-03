import { createHmac } from "crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS §5.24/§14.22 (Module 18, External-SaaS Integration Hooks) - both hooks
 * are goto5x.com's own side only; the external SaaS products themselves are
 * out of scope by design (the founder's own instruction, §3.10) - every test
 * here exercises goto5x's API surface, never a mock of the other product.
 */
describe("External-SaaS Integration Hooks (e2e) - SRS §5.24, §14.22", () => {
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
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, storeId: store.body.id as string, sellerId: seller.id as string };
  }

  async function fullyVerifiedAdminToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash("admin-password", 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer())
      .post("/admin/auth/login")
      .send({ email, password: "admin-password" });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken;
  }

  /** Registers a client via the real admin endpoint and returns its plaintext secret (shown once, exactly as the real flow works). */
  async function registerClient(adminToken: string, clientType: "template_store" | "social_media_saas") {
    const res = await request(app.getHttpServer())
      .post("/admin/external-api-clients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ clientType, displayName: clientType });
    return { clientId: res.body.id as string, secret: res.body.signingSecret as string };
  }

  function sign(secret: string, timestamp: string, payload: string): string {
    return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  }

  describe("Template Install/License API (FR-24.3-24.7)", () => {
    it("a correctly signed install call creates a themes entry and grants the entitlement, scoped to the calling seller only", async () => {
      const adminToken = await fullyVerifiedAdminToken("t-install-admin@example.com");
      const { secret } = await registerClient(adminToken, "template_store");
      const seller = await signupLoginAndCreateStore("t-install-seller@example.com", "t-install-store");

      const body = JSON.stringify({
        sellerId: seller.sellerId,
        themeName: "Boutique Deluxe",
        themeVersion: "1.0.0",
        purchaseRef: "purchase-abc-123",
      });
      const timestamp = String(Date.now());

      const install = await request(app.getHttpServer())
        .post("/external/template-store/install")
        .set("Content-Type", "application/json")
        .set("x-goto5x-client-type", "template_store")
        .set("x-goto5x-timestamp", timestamp)
        .set("x-goto5x-signature", sign(secret, timestamp, body))
        .send(body);

      expect(install.status).toBe(201);
      expect(install.body.themeId).toBeTruthy();

      const theme = await superuser.theme.findUnique({ where: { id: install.body.themeId } });
      expect(theme?.tier).toBe("marketplace");

      const entitlement = await superuser.templateEntitlement.findUnique({
        where: { sellerId_themeId: { sellerId: seller.sellerId, themeId: install.body.themeId } },
      });
      expect(entitlement).not.toBeNull();
      expect(entitlement?.revokedAt).toBeNull();

      // FR-24.6/24.13 - traceable, system-actor grant with a referral-attribution signal.
      const auditRow = await superuser.adminAuditLog.findFirst({ where: { action: "template_entitlement.granted" } });
      expect(auditRow?.adminUserId).toBeNull();
      expect((auditRow?.afterValue as any)?.referralAttributed).toBe(true);
    });

    it("rejects an unsigned install call before any entitlement is granted (security release gate)", async () => {
      const adminToken = await fullyVerifiedAdminToken("t-unsigned-admin@example.com");
      await registerClient(adminToken, "template_store");
      const seller = await signupLoginAndCreateStore("t-unsigned-seller@example.com", "t-unsigned-store");

      const res = await request(app.getHttpServer())
        .post("/external/template-store/install")
        .send({ sellerId: seller.sellerId, themeName: "Unsigned Theme", themeVersion: "1.0.0", purchaseRef: "x" });

      expect(res.status).toBe(401);
      const theme = await superuser.theme.findFirst({ where: { name: "Unsigned Theme" } });
      expect(theme).toBeNull();
    });

    it("rejects an invalidly-signed install call (wrong secret) before any entitlement is granted", async () => {
      const adminToken = await fullyVerifiedAdminToken("t-badsig-admin@example.com");
      await registerClient(adminToken, "template_store");
      const seller = await signupLoginAndCreateStore("t-badsig-seller@example.com", "t-badsig-store");

      const body = JSON.stringify({
        sellerId: seller.sellerId,
        themeName: "Bad Sig Theme",
        themeVersion: "1.0.0",
        purchaseRef: "x",
      });
      const timestamp = String(Date.now());

      const res = await request(app.getHttpServer())
        .post("/external/template-store/install")
        .set("Content-Type", "application/json")
        .set("x-goto5x-client-type", "template_store")
        .set("x-goto5x-timestamp", timestamp)
        .set("x-goto5x-signature", sign("totally-wrong-secret", timestamp, body))
        .send(body);

      expect(res.status).toBe(401);
      const theme = await superuser.theme.findFirst({ where: { name: "Bad Sig Theme" } });
      expect(theme).toBeNull();
    });

    it("rejects every call once the admin disables the client (FR-8.14)", async () => {
      const adminToken = await fullyVerifiedAdminToken("t-disabled-admin@example.com");
      const { clientId, secret } = await registerClient(adminToken, "template_store");
      await request(app.getHttpServer())
        .patch(`/admin/external-api-clients/${clientId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isEnabled: false });
      const seller = await signupLoginAndCreateStore("t-disabled-seller@example.com", "t-disabled-store");

      const body = JSON.stringify({
        sellerId: seller.sellerId,
        themeName: "Disabled Client Theme",
        themeVersion: "1.0.0",
        purchaseRef: "x",
      });
      const timestamp = String(Date.now());
      const res = await request(app.getHttpServer())
        .post("/external/template-store/install")
        .set("Content-Type", "application/json")
        .set("x-goto5x-client-type", "template_store")
        .set("x-goto5x-timestamp", timestamp)
        .set("x-goto5x-signature", sign(secret, timestamp, body))
        .send(body);

      expect(res.status).toBe(401);
    });

    it("a revoke call removes only that seller's entitlement, leaving the themes catalog entry and other sellers' entitlements untouched", async () => {
      const adminToken = await fullyVerifiedAdminToken("t-revoke-admin@example.com");
      const { secret } = await registerClient(adminToken, "template_store");
      const sellerA = await signupLoginAndCreateStore("t-revoke-a@example.com", "t-revoke-a-store");
      const sellerB = await signupLoginAndCreateStore("t-revoke-b@example.com", "t-revoke-b-store");

      async function install(sellerId: string) {
        const body = JSON.stringify({ sellerId, themeName: "Shared Theme", themeVersion: "1.0.0", purchaseRef: "x" });
        const timestamp = String(Date.now());
        return request(app.getHttpServer())
          .post("/external/template-store/install")
          .set("Content-Type", "application/json")
          .set("x-goto5x-client-type", "template_store")
          .set("x-goto5x-timestamp", timestamp)
          .set("x-goto5x-signature", sign(secret, timestamp, body))
          .send(body);
      }
      const installA = await install(sellerA.sellerId);
      await install(sellerB.sellerId);
      const themeId = installA.body.themeId;

      const revokeBody = JSON.stringify({ sellerId: sellerA.sellerId, themeName: "Shared Theme", themeVersion: "1.0.0" });
      const revokeTimestamp = String(Date.now());
      const revoke = await request(app.getHttpServer())
        .post("/external/template-store/revoke")
        .set("Content-Type", "application/json")
        .set("x-goto5x-client-type", "template_store")
        .set("x-goto5x-timestamp", revokeTimestamp)
        .set("x-goto5x-signature", sign(secret, revokeTimestamp, revokeBody))
        .send(revokeBody);
      expect(revoke.status).toBe(201);

      const entitlementA = await superuser.templateEntitlement.findUnique({
        where: { sellerId_themeId: { sellerId: sellerA.sellerId, themeId } },
      });
      expect(entitlementA?.revokedAt).not.toBeNull();

      const entitlementB = await superuser.templateEntitlement.findUnique({
        where: { sellerId_themeId: { sellerId: sellerB.sellerId, themeId } },
      });
      expect(entitlementB?.revokedAt).toBeNull();

      const theme = await superuser.theme.findUnique({ where: { id: themeId } });
      expect(theme).not.toBeNull();
    });

    it("FR-24.5: a Free-Plan seller with a marketplace entitlement can select it despite the plan-tier gate excluding premium templates", async () => {
      const adminToken = await fullyVerifiedAdminToken("t-fr245-admin@example.com");
      const { secret } = await registerClient(adminToken, "template_store");
      const seller = await signupLoginAndCreateStore("t-fr245-seller@example.com", "t-fr245-store");

      // Premium-tier gate is off by default (v1.0) - confirm the Free-Plan
      // seller genuinely cannot select an ordinary premium theme.
      const premiumTheme = await superuser.theme.findFirstOrThrow({ where: { name: "Studio" } });
      const rejectedPremium = await request(app.getHttpServer())
        .patch(`/stores/${seller.storeId}/theme-settings`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ themeId: premiumTheme.id });
      expect(rejectedPremium.status).toBe(403);

      // Marketplace entitlement bypasses that same gate independently.
      const body = JSON.stringify({
        sellerId: seller.sellerId,
        themeName: "Marketplace Exclusive",
        themeVersion: "1.0.0",
        purchaseRef: "x",
      });
      const timestamp = String(Date.now());
      const install = await request(app.getHttpServer())
        .post("/external/template-store/install")
        .set("Content-Type", "application/json")
        .set("x-goto5x-client-type", "template_store")
        .set("x-goto5x-timestamp", timestamp)
        .set("x-goto5x-signature", sign(secret, timestamp, body))
        .send(body);

      const select = await request(app.getHttpServer())
        .patch(`/stores/${seller.storeId}/theme-settings`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ themeId: install.body.themeId });
      expect(select.status).toBe(200);

      const listing = await request(app.getHttpServer()).get("/themes").set("Authorization", `Bearer ${seller.token}`);
      const marketplaceEntry = listing.body.find((t: any) => t.id === install.body.themeId);
      expect(marketplaceEntry.entitled).toBe(true);
      const premiumEntry = listing.body.find((t: any) => t.id === premiumTheme.id);
      expect(premiumEntry.entitled).toBe(true); // `entitled` is only meaningful for marketplace tier - always true otherwise, the plan-tier gate is enforced separately at selection time
    });
  });

  describe("Product Feed API (FR-24.9-24.11)", () => {
    it("returns only the calling seller's own products, tenant-isolated, and rejects a revoked or disabled token", async () => {
      const sellerA = await signupLoginAndCreateStore("feed-a@example.com", "feed-a-store");
      const sellerB = await signupLoginAndCreateStore("feed-b@example.com", "feed-b-store");
      await superuser.seller.update({ where: { id: sellerA.sellerId }, data: { isTrusted: true } });
      await superuser.seller.update({ where: { id: sellerB.sellerId }, data: { isTrusted: true } });

      const productA = await request(app.getHttpServer())
        .post(`/stores/${sellerA.storeId}/products`)
        .set("Authorization", `Bearer ${sellerA.token}`)
        .send({ title: "Seller A Widget", status: "active" });
      const productB = await request(app.getHttpServer())
        .post(`/stores/${sellerB.storeId}/products`)
        .set("Authorization", `Bearer ${sellerB.token}`)
        .send({ title: "Seller B Widget", status: "active" });
      expect(productA.status).toBe(201);
      expect(productB.status).toBe(201);

      const adminToken = await fullyVerifiedAdminToken("feed-admin@example.com");
      await registerClient(adminToken, "social_media_saas");

      const tokenRes = await request(app.getHttpServer())
        .post("/sellers/me/api-tokens")
        .set("Authorization", `Bearer ${sellerA.token}`);
      expect(tokenRes.status).toBe(201);
      const feedToken = tokenRes.body.token as string;

      const feed = await request(app.getHttpServer())
        .get("/external/social-media/product-feed")
        .set("Authorization", `Bearer ${feedToken}`);
      expect(feed.status).toBe(200);
      expect(feed.body.some((p: any) => p.title === "Seller A Widget")).toBe(true);
      expect(feed.body.some((p: any) => p.title === "Seller B Widget")).toBe(false);

      // FR-24.10 - revoking the token rejects its very next use.
      const revoke = await request(app.getHttpServer())
        .delete(`/sellers/me/api-tokens/${tokenRes.body.id}`)
        .set("Authorization", `Bearer ${sellerA.token}`);
      expect(revoke.status).toBe(200);

      const afterRevoke = await request(app.getHttpServer())
        .get("/external/social-media/product-feed")
        .set("Authorization", `Bearer ${feedToken}`);
      expect(afterRevoke.status).toBe(401);
    });

    it("rejects a request with no bearer token, and rejects a token whose client the admin has disabled (FR-8.14)", async () => {
      const seller = await signupLoginAndCreateStore("feed-disabled@example.com", "feed-disabled-store");
      const adminToken = await fullyVerifiedAdminToken("feed-disabled-admin@example.com");
      const { clientId } = await registerClient(adminToken, "social_media_saas");

      const noAuth = await request(app.getHttpServer()).get("/external/social-media/product-feed");
      expect(noAuth.status).toBe(401);

      const tokenRes = await request(app.getHttpServer())
        .post("/sellers/me/api-tokens")
        .set("Authorization", `Bearer ${seller.token}`);

      await request(app.getHttpServer())
        .patch(`/admin/external-api-clients/${clientId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isEnabled: false });

      const feed = await request(app.getHttpServer())
        .get("/external/social-media/product-feed")
        .set("Authorization", `Bearer ${tokenRes.body.token}`);
      expect(feed.status).toBe(401);
    });
  });

  describe("Seller API tokens dashboard (FR-24.10) and cross-SaaS eligibility (FR-24.14)", () => {
    it("a seller can list their connected tokens without ever seeing the plaintext again", async () => {
      const seller = await signupLoginAndCreateStore("tokens-list@example.com", "tokens-list-store");
      const adminToken = await fullyVerifiedAdminToken("tokens-list-admin@example.com");
      await registerClient(adminToken, "social_media_saas");

      await request(app.getHttpServer()).post("/sellers/me/api-tokens").set("Authorization", `Bearer ${seller.token}`);
      const list = await request(app.getHttpServer())
        .get("/sellers/me/api-tokens")
        .set("Authorization", `Bearer ${seller.token}`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
      expect(JSON.stringify(list.body)).not.toContain("tokenHash");
    });

    it("the eligibility endpoint answers correctly for a paid vs. Free-plan seller, returns only the boolean, and rejects an unsigned call", async () => {
      const seller = await signupLoginAndCreateStore("eligibility@example.com", "eligibility-store");
      const adminToken = await fullyVerifiedAdminToken("eligibility-admin@example.com");
      const { secret } = await registerClient(adminToken, "template_store");

      const timestamp1 = String(Date.now());
      const query1 = `sellerId=${seller.sellerId}`;
      const freeCheck = await request(app.getHttpServer())
        .get(`/external/eligibility?${query1}`)
        .set("x-goto5x-client-type", "template_store")
        .set("x-goto5x-timestamp", timestamp1)
        .set("x-goto5x-signature", sign(secret, timestamp1, query1));
      expect(freeCheck.status).toBe(200);
      expect(freeCheck.body).toEqual({ eligible: false });

      // Move the seller onto a paid plan directly (Module 14's own concern, not this module's focus).
      const paidPlan = await superuser.plan.findFirstOrThrow({ where: { tierOrder: { gt: 0 } } });
      await superuser.subscription.update({ where: { sellerId: seller.sellerId }, data: { planId: paidPlan.id } });

      const timestamp2 = String(Date.now());
      const paidCheck = await request(app.getHttpServer())
        .get(`/external/eligibility?${query1}`)
        .set("x-goto5x-client-type", "template_store")
        .set("x-goto5x-timestamp", timestamp2)
        .set("x-goto5x-signature", sign(secret, timestamp2, query1));
      expect(paidCheck.status).toBe(200);
      expect(paidCheck.body).toEqual({ eligible: true });

      const unsigned = await request(app.getHttpServer()).get(`/external/eligibility?${query1}`);
      expect(unsigned.status).toBe(401);
    });
  });

  describe("Marketing SSO handoff (FR-24.8/24.13) and admin registry (FR-8.14)", () => {
    it("returns a documented error (never a broken link) when the Social Media SaaS isn't configured yet", async () => {
      const seller = await signupLoginAndCreateStore("handoff-unconfigured@example.com", "handoff-unconfigured-store");
      const res = await request(app.getHttpServer())
        .post("/sellers/me/marketing-handoff")
        .set("Authorization", `Bearer ${seller.token}`);
      expect(res.status).toBe(400);
    });

    it("once configured, mints an SSO handoff URL and records a referral-attribution audit entry", async () => {
      const adminToken = await fullyVerifiedAdminToken("handoff-admin@example.com");
      await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ key: "social_media_saas.marketing_handoff_base_url", scopeType: "global", value: "https://social.example.com/sso" });

      const seller = await signupLoginAndCreateStore("handoff-ok@example.com", "handoff-ok-store");
      const res = await request(app.getHttpServer())
        .post("/sellers/me/marketing-handoff")
        .set("Authorization", `Bearer ${seller.token}`);
      expect(res.status).toBe(201);
      expect(res.body.url).toContain("https://social.example.com/sso?sso_token=");

      const auditRow = await superuser.adminAuditLog.findFirst({ where: { action: "saas_referral.sso_handoff" } });
      expect(auditRow?.adminUserId).toBeNull();
      expect((auditRow?.afterValue as any)?.referralAttributed).toBe(true);
    });

    it("admin can list, register, and toggle both external API clients independently of one another", async () => {
      const adminToken = await fullyVerifiedAdminToken("registry-admin@example.com");
      const { clientId: templateStoreId } = await registerClient(adminToken, "template_store");
      const { clientId: socialId } = await registerClient(adminToken, "social_media_saas");

      const list = await request(app.getHttpServer())
        .get("/admin/external-api-clients")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(2);
      expect(JSON.stringify(list.body)).not.toContain("signingSecretEncrypted");

      await request(app.getHttpServer())
        .patch(`/admin/external-api-clients/${templateStoreId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isEnabled: false });

      const after = await request(app.getHttpServer())
        .get("/admin/external-api-clients")
        .set("Authorization", `Bearer ${adminToken}`);
      const templateStoreRow = after.body.find((c: any) => c.id === templateStoreId);
      const socialRow = after.body.find((c: any) => c.id === socialId);
      expect(templateStoreRow.isEnabled).toBe(false);
      expect(socialRow.isEnabled).toBe(true); // disabling one client never affects the other
    });
  });
});
