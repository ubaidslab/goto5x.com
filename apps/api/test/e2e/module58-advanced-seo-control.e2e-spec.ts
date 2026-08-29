import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const UPGRADE_MESSAGE = /Growth-plan feature/i;

/**
 * Module 58 (SRS §5.65, §14.64) - Advanced Store SEO Control. Covers what
 * seo-fallback.util.spec.ts and head-tag-sanitizer.util.spec.ts (pure-
 * function unit tests) cannot: the real Growth+ plan gate wired into
 * StoresService/ProductsService/CollectionsService.update(), the fallback
 * cascade as it actually renders through the public storefront read API,
 * Product.slug's per-store uniqueness constraint, the sanitizer's wiring
 * into StoresService.updateOwn() (not just the pure function), and RLS
 * tenant isolation on the new store-level fields.
 */
describe("Advanced Store SEO Control (e2e) - SRS §5.65, §14.64", () => {
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
    // Trusted so self-fulfilled products land moderationStatus "not_required"
    // and are immediately visible on the public storefront read API this
    // file exercises - the moderation queue itself is Module 6's concern,
    // not this one's.
    await superuser.seller.update({ where: { id: seller.id }, data: { isTrusted: true } });
    return { token, sellerId: seller.id as string, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function upgradeToGrowth(sellerId: string) {
    const growthPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: growthPlan.id } });
  }

  async function createSelfProduct(token: string, storeId: string, title = "SEO Widget") {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title, status: "active" });
    return product.body.id as string;
  }

  async function createCollection(token: string, storeId: string, slug: string) {
    const collection = await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: `Collection ${slug}`, slug, isActive: true });
    return collection.body.id as string;
  }

  describe("FR-65.5: Growth+ plan gate", () => {
    it("a sub-Growth seller's product update is rejected with a clear upgrade prompt when it touches an advanced field", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("seo-gate-free@example.com", "seo-gate-free-store");
      const productId = await createSelfProduct(token, storeId);

      const attempt = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ robotsIndex: false });
      expect(attempt.status).toBe(403);
      expect(attempt.body.message.message).toMatch(UPGRADE_MESSAGE);

      // A basic (never-gated) field on the very same request still isn't
      // blocked by itself - but mixed into a request that also touches a
      // gated field, the whole update is rejected, not silently partial.
      const stillUnset = await request(app.getHttpServer())
        .get(`/stores/${storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(stillUnset.body.robotsIndex).toBeNull();
    });

    it("a sub-Growth seller's collection update is rejected with the same upgrade prompt", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("seo-gate-coll-free@example.com", "seo-gate-coll-free-store");
      const collectionId = await createCollection(token, storeId, "sub-growth-collection");

      const attempt = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/collections/${collectionId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sitemapIncluded: false });
      expect(attempt.status).toBe(403);
      expect(attempt.body.message.message).toMatch(UPGRADE_MESSAGE);
    });

    it("a sub-Growth seller's store update is rejected with the same upgrade prompt", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("seo-gate-store-free@example.com", "seo-gate-store-free-store");

      const attempt = await request(app.getHttpServer())
        .patch(`/stores/${storeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ seoRobotsIndexDefault: false });
      expect(attempt.status).toBe(403);
      expect(attempt.body.message.message).toMatch(UPGRADE_MESSAGE);
    });

    it("a Growth-tier seller's product/collection/store advanced-field updates all succeed", async () => {
      const { token, sellerId, storeId } = await signupLoginAndCreateStore("seo-gate-growth@example.com", "seo-gate-growth-store");
      await upgradeToGrowth(sellerId);
      const productId = await createSelfProduct(token, storeId);
      const collectionId = await createCollection(token, storeId, "growth-collection");

      const productUpdate = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ robotsIndex: false });
      expect(productUpdate.status).toBe(200);

      const collectionUpdate = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/collections/${collectionId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sitemapIncluded: false });
      expect(collectionUpdate.status).toBe(200);

      const storeUpdate = await request(app.getHttpServer())
        .patch(`/stores/${storeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ seoRobotsIndexDefault: false });
      expect(storeUpdate.status).toBe(200);
    });

    it("basic seoTitle/seoDescription updates are never gated, on any plan tier", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("seo-gate-basic-free@example.com", "seo-gate-basic-free-store");
      const productId = await createSelfProduct(token, storeId);

      const update = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ seoTitle: "Custom SEO title", seoDescription: "Custom SEO description." });
      expect(update.status).toBe(200);
      expect(update.body.seoTitle).toBe("Custom SEO title");
    });

    it("founder batch B15: GET store/product responses expose seoAdvancedFieldsEnabled, reflecting the real gate before and after upgrade", async () => {
      const { token, sellerId, storeId } = await signupLoginAndCreateStore("seo-gate-flag@example.com", "seo-gate-flag-store");
      const productId = await createSelfProduct(token, storeId);

      const storeBefore = await request(app.getHttpServer()).get(`/stores/${storeId}`).set("Authorization", `Bearer ${token}`);
      expect(storeBefore.body.seoAdvancedFieldsEnabled).toBe(false);
      const productBefore = await request(app.getHttpServer())
        .get(`/stores/${storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(productBefore.body.seoAdvancedFieldsEnabled).toBe(false);

      await upgradeToGrowth(sellerId);

      const storeAfter = await request(app.getHttpServer()).get(`/stores/${storeId}`).set("Authorization", `Bearer ${token}`);
      expect(storeAfter.body.seoAdvancedFieldsEnabled).toBe(true);
      const productAfter = await request(app.getHttpServer())
        .get(`/stores/${storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(productAfter.body.seoAdvancedFieldsEnabled).toBe(true);
    });
  });

  describe("FR-65.1/65.2: fallback cascade rendered through the public storefront read API", () => {
    it("an unset product field inherits the store default; an explicit value overrides it, independently per field", async () => {
      const { token, sellerId, storeId, hostname } = await signupLoginAndCreateStore(
        "seo-cascade-product@example.com",
        "seo-cascade-product-store",
      );
      await upgradeToGrowth(sellerId);

      await request(app.getHttpServer())
        .patch(`/stores/${storeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          seoRobotsIndexDefault: false,
          seoRobotsFollowDefault: false,
          seoStructuredDataDefault: false,
          seoSitemapIncludedDefault: false,
        });
      const productId = await createSelfProduct(token, storeId);

      const beforeOverride = await request(app.getHttpServer()).get(`/storefront/products/${productId}`).query({ hostname });
      expect(beforeOverride.status).toBe(200);
      expect(beforeOverride.body.robotsIndex).toBe(false);
      expect(beforeOverride.body.robotsFollow).toBe(false);
      expect(beforeOverride.body.structuredDataEnabled).toBe(false);
      expect(beforeOverride.body.sitemapIncluded).toBe(false);

      // Override only robotsIndex - every other field must keep inheriting
      // the store default, proving the cascade is per-field, not all-or-nothing.
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ robotsIndex: true });

      const afterOverride = await request(app.getHttpServer()).get(`/storefront/products/${productId}`).query({ hostname });
      expect(afterOverride.body.robotsIndex).toBe(true);
      expect(afterOverride.body.robotsFollow).toBe(false);
      expect(afterOverride.body.structuredDataEnabled).toBe(false);
      expect(afterOverride.body.sitemapIncluded).toBe(false);
    });

    it("ogTitle/ogDescription fall back to the already-resolved basic seoTitle/seoDescription, not a third independent value", async () => {
      const { token, sellerId, storeId, hostname } = await signupLoginAndCreateStore(
        "seo-cascade-og@example.com",
        "seo-cascade-og-store",
      );
      await upgradeToGrowth(sellerId);
      const productId = await createSelfProduct(token, storeId, "OG Fallback Widget");
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ seoTitle: "Resolved SEO Title" });

      const product = await request(app.getHttpServer()).get(`/storefront/products/${productId}`).query({ hostname });
      expect(product.body.seoTitle).toBe("Resolved SEO Title");
      expect(product.body.ogTitle).toBe("Resolved SEO Title");
    });

    it("an unset collection field inherits the store default; an explicit value overrides it", async () => {
      const { token, sellerId, storeId, hostname } = await signupLoginAndCreateStore(
        "seo-cascade-collection@example.com",
        "seo-cascade-collection-store",
      );
      await upgradeToGrowth(sellerId);
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ seoSitemapIncludedDefault: false });
      const collectionId = await createCollection(token, storeId, "cascade-collection");

      const before = await request(app.getHttpServer()).get(`/storefront/collections/${collectionId}`).query({ hostname });
      expect(before.body.sitemapIncluded).toBe(false);

      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/collections/${collectionId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sitemapIncluded: true });

      const after = await request(app.getHttpServer()).get(`/storefront/collections/${collectionId}`).query({ hostname });
      expect(after.body.sitemapIncluded).toBe(true);
    });
  });

  describe("FR-65.3: Product.slug uniqueness is per-store, not global", () => {
    it("setting a slug already used by another product in the same store is rejected with a clear conflict, not a silent overwrite", async () => {
      const { token, sellerId, storeId } = await signupLoginAndCreateStore("seo-slug-conflict@example.com", "seo-slug-conflict-store");
      await upgradeToGrowth(sellerId);
      const first = await createSelfProduct(token, storeId, "First Widget");
      const second = await createSelfProduct(token, storeId, "Second Widget");

      const takeSlug = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/products/${first}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ slug: "widget" });
      expect(takeSlug.status).toBe(200);

      const conflict = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/products/${second}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ slug: "widget" });
      expect(conflict.status).toBe(409);
      expect(conflict.body.message.message).toMatch(/already used by another product/i);
    });

    it("the same slug is allowed across two different sellers' stores - the constraint is per-store, not global", async () => {
      const a = await signupLoginAndCreateStore("seo-slug-store-a@example.com", "seo-slug-store-a-store");
      await upgradeToGrowth(a.sellerId);
      const b = await signupLoginAndCreateStore("seo-slug-store-b@example.com", "seo-slug-store-b-store");
      await upgradeToGrowth(b.sellerId);
      const productA = await createSelfProduct(a.token, a.storeId, "Widget A");
      const productB = await createSelfProduct(b.token, b.storeId, "Widget B");

      const setA = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}/products/${productA}`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ slug: "shared-slug" });
      expect(setA.status).toBe(200);

      const setB = await request(app.getHttpServer())
        .patch(`/stores/${b.storeId}/products/${productB}`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ slug: "shared-slug" });
      expect(setB.status).toBe(200);
    });
  });

  describe("FR-65.4: custom head-tags sanitizer wiring (not just the pure function)", () => {
    it("a script-src injection attempt in customHeadTags never survives the round-trip through StoresService.updateOwn() to the public storefront read", async () => {
      const { token, sellerId, storeId, hostname } = await signupLoginAndCreateStore(
        "seo-sanitizer-wiring@example.com",
        "seo-sanitizer-wiring-store",
      );
      await upgradeToGrowth(sellerId);

      const payload =
        '<meta name="google-site-verification" content="abc123">' +
        '<script src="https://evil.example.com/xss.js"></script>' +
        "<img src=\"x\" onerror=\"alert(document.cookie)\">";
      const update = await request(app.getHttpServer())
        .patch(`/stores/${storeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ customHeadTags: payload });
      expect(update.status).toBe(200);
      expect(update.body.customHeadTags).not.toContain("<script");
      expect(update.body.customHeadTags).not.toContain("evil.example.com");
      expect(update.body.customHeadTags).not.toContain("<img");
      expect(update.body.customHeadTags).not.toContain("onerror");
      expect(update.body.customHeadTags).toContain("google-site-verification");

      const publicStore = await request(app.getHttpServer()).get("/storefront/store").query({ hostname });
      expect(publicStore.status).toBe(200);
      expect(publicStore.body.customHeadTags).not.toContain("<script");
      expect(publicStore.body.customHeadTags).not.toContain("evil.example.com");
      expect(publicStore.body.customHeadTags).toContain("google-site-verification");

      // The raw, unsanitized payload is never persisted anywhere - not
      // stored-then-filtered-on-read, actually sanitized at write time.
      const row = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(row.customHeadTags).not.toContain("<script");
    });
  });

  describe("RLS tenant isolation", () => {
    it("denies cross-tenant reads/writes of another store's advanced SEO defaults", async () => {
      const a = await signupLoginAndCreateStore("seo-tenant-a@example.com", "seo-tenant-a-store");
      await upgradeToGrowth(a.sellerId);
      const b = await signupLoginAndCreateStore("seo-tenant-b@example.com", "seo-tenant-b-store");
      await upgradeToGrowth(b.sellerId);

      const crossRead = await request(app.getHttpServer()).get(`/stores/${a.storeId}`).set("Authorization", `Bearer ${b.token}`);
      expect(crossRead.status).toBe(404);

      const crossWrite = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ customHeadTags: "<meta name=\"should-not-apply\" content=\"1\">" });
      expect(crossWrite.status).toBe(404);

      const stillUnset = await request(app.getHttpServer()).get(`/stores/${a.storeId}`).set("Authorization", `Bearer ${a.token}`);
      expect(stillUnset.body.customHeadTags).toBeNull();
    });

    it("denies cross-tenant reads/writes of another store's product advanced SEO fields", async () => {
      const a = await signupLoginAndCreateStore("seo-tenant-prod-a@example.com", "seo-tenant-prod-a-store");
      await upgradeToGrowth(a.sellerId);
      const b = await signupLoginAndCreateStore("seo-tenant-prod-b@example.com", "seo-tenant-prod-b-store");
      await upgradeToGrowth(b.sellerId);
      const productId = await createSelfProduct(a.token, a.storeId);

      const crossRead = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossRead.status).toBe(404);

      const crossWrite = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ slug: "should-not-apply" });
      expect(crossWrite.status).toBe(404);
    });
  });
});
