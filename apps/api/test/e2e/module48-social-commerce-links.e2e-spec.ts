import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";
import * as bcrypt from "bcryptjs";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 48 (SRS §5.55, FR-55.1-55.5) - Facebook/Instagram Shop Feed +
 * WhatsApp catalog links. Both capabilities reuse existing machinery
 * (FR-24.9's Product Feed API auth/rate-limit/RLS shape for the Meta
 * catalog feed; §5.41's wa.me link construction + Settings-Registry
 * template mechanism for the product-share generator) rather than new
 * integrations, and both are gated Growth-tier (RISE) and above.
 */
describe("Facebook/Instagram Shop Feed & WhatsApp Catalog Links (e2e) - SRS §5.55", () => {
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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId };
  }

  async function createActiveProductWithVariant(token: string, storeId: string, title: string, price = 1500) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title, status: "active" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `sku-${product.body.id}`, price, stockQuantity: 10 });
    return product.body.id as string;
  }

  async function upgradeToTier(sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: plan.id } });
  }

  async function fullyVerifiedAdminToken(email: string): Promise<string> {
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

  async function registerSocialClient(adminToken: string) {
    const res = await request(app.getHttpServer())
      .post("/admin/external-api-clients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ clientType: "social_media_saas", displayName: "social_media_saas" });
    return res.body.id as string;
  }

  describe("Meta Commerce Catalog feed (FR-55.1-55.3)", () => {
    it("a RISE seller gets a Meta-format feed with the extra fields, isolated to their own products only", async () => {
      const adminToken = await fullyVerifiedAdminToken("meta-feed-admin@example.com");
      await registerSocialClient(adminToken);

      const sellerA = await signupLoginAndCreateStore("meta-feed-a@example.com", "meta-feed-a-store");
      const sellerB = await signupLoginAndCreateStore("meta-feed-b@example.com", "meta-feed-b-store");
      await upgradeToTier(sellerA.sellerId, 2); // RISE

      const productId = await createActiveProductWithVariant(sellerA.token, sellerA.storeId, "Meta Feed Widget", 2000);
      await createActiveProductWithVariant(sellerB.token, sellerB.storeId, "Other Seller Widget", 1000);

      const tokenRes = await request(app.getHttpServer())
        .post("/sellers/me/api-tokens")
        .set("Authorization", `Bearer ${sellerA.token}`);
      expect(tokenRes.status).toBe(201);

      const feed = await request(app.getHttpServer())
        .get("/external/social-media/meta-catalog-feed")
        .set("Authorization", `Bearer ${tokenRes.body.token}`);
      expect(feed.status).toBe(200);
      expect(feed.body).toHaveLength(1);
      const item = feed.body[0];
      expect(item.id).toBe(productId);
      expect(item.title).toBe("Meta Feed Widget");
      expect(item.availability).toBe("in stock");
      expect(item.condition).toBe("new");
      expect(item.currency).toBe("PKR");
      expect(item.brand).toBe(`Store for meta-feed-a@example.com`);
      expect(typeof item.description).toBe("string");
      expect(feed.body.some((p: any) => p.title === "Other Seller Widget")).toBe(false);
    });

    it("a GO/RUN seller (below Growth) is rejected with a clear upgrade message, never partial data", async () => {
      const adminToken = await fullyVerifiedAdminToken("meta-feed-gate-admin@example.com");
      await registerSocialClient(adminToken);
      const seller = await signupLoginAndCreateStore("meta-feed-gate@example.com", "meta-feed-gate-store");
      // Default tier is GO (tierOrder 0) - never explicitly upgraded here.
      await createActiveProductWithVariant(seller.token, seller.storeId, "Gated Widget");

      const tokenRes = await request(app.getHttpServer())
        .post("/sellers/me/api-tokens")
        .set("Authorization", `Bearer ${seller.token}`);

      const feed = await request(app.getHttpServer())
        .get("/external/social-media/meta-catalog-feed")
        .set("Authorization", `Bearer ${tokenRes.body.token}`);
      expect(feed.status).toBe(403);
      expect(feed.body.message).toMatch(/growth/i);

      // The pre-existing, ungated Product Feed API is unaffected by this new gate.
      const legacyFeed = await request(app.getHttpServer())
        .get("/external/social-media/product-feed")
        .set("Authorization", `Bearer ${tokenRes.body.token}`);
      expect(legacyFeed.status).toBe(200);
    });

    it("rejects a request with no bearer token", async () => {
      const res = await request(app.getHttpServer()).get("/external/social-media/meta-catalog-feed");
      expect(res.status).toBe(401);
    });
  });

  describe("WhatsApp product-share link (FR-55.4)", () => {
    it("a RISE seller gets a share link for a published product, with no recipient phone segment (share picker, not a pre-addressed chat)", async () => {
      const seller = await signupLoginAndCreateStore("share-link@example.com", "share-link-store");
      await upgradeToTier(seller.sellerId, 2); // RISE
      const productId = await createActiveProductWithVariant(seller.token, seller.storeId, "Shareable Widget", 999);

      const res = await request(app.getHttpServer())
        .get(`/stores/${seller.storeId}/whatsapp/products/${productId}/share-link`)
        .set("Authorization", `Bearer ${seller.token}`);
      expect(res.status).toBe(200);
      expect(res.body.deepLink).toMatch(/^https:\/\/wa\.me\/\?text=/);
      const decoded = decodeURIComponent(res.body.deepLink.split("?text=")[1]);
      expect(decoded).toContain("Shareable Widget");
    });

    it("a GO seller is rejected with a clear upgrade message", async () => {
      const seller = await signupLoginAndCreateStore("share-link-gated@example.com", "share-link-gated-store");
      const productId = await createActiveProductWithVariant(seller.token, seller.storeId, "Gated Share Widget");

      const res = await request(app.getHttpServer())
        .get(`/stores/${seller.storeId}/whatsapp/products/${productId}/share-link`)
        .set("Authorization", `Bearer ${seller.token}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/growth/i);
    });

    it("rejects a draft (unpublished) product even for a RISE seller", async () => {
      const seller = await signupLoginAndCreateStore("share-link-draft@example.com", "share-link-draft-store");
      await upgradeToTier(seller.sellerId, 2); // RISE
      const draft = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/products`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ title: "Draft Widget" });

      const res = await request(app.getHttpServer())
        .get(`/stores/${seller.storeId}/whatsapp/products/${draft.body.id}/share-link`)
        .set("Authorization", `Bearer ${seller.token}`);
      expect(res.status).toBe(400);
    });

    it("the seller-editable template is honored (FR-41.3's existing mechanism)", async () => {
      const seller = await signupLoginAndCreateStore("share-link-template@example.com", "share-link-template-store");
      await upgradeToTier(seller.sellerId, 2); // RISE
      const productId = await createActiveProductWithVariant(seller.token, seller.storeId, "Templated Widget", 500);

      await superuser.settingsValue.create({
        data: {
          definitionKey: "whatsapp.product_share_template",
          scopeType: "store",
          scopeId: seller.storeId,
          value: "Custom: {{product_title}}!",
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/stores/${seller.storeId}/whatsapp/products/${productId}/share-link`)
        .set("Authorization", `Bearer ${seller.token}`);
      expect(res.status).toBe(200);
      const decoded = decodeURIComponent(res.body.deepLink.split("?text=")[1]);
      expect(decoded).toBe("Custom: Templated Widget!");
    });
  });
});
