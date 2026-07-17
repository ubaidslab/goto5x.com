import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS FR-1.5/FR-11.2, §14.1 - the public, unauthenticated storefront read
 * API: hostname resolution (verified custom domain first, free subdomain
 * fallback), the SEO fallback chain end-to-end, and that hidden/inactive
 * stores and cross-store product access behave correctly. Sitemap/robots
 * *generation* itself lives in apps/web (no test harness there yet - see
 * this module's verification report) - what's tested here is the data
 * (`canonicalHostname`, `accessMode`) that drives it, which is the part
 * that can go subtly wrong (wrong domain precedence, RLS-bypass leaks).
 */
describe("Storefront public read API (e2e) - SRS FR-1.5/FR-11.2, §14.1", () => {
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
      .send({ email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    // This file tests the storefront read API (hostname resolution, SEO
    // fallback), not the Listing Moderation Engine (Module 6) - marking the
    // seller trusted (FR-27.4) sidesteps the default new-seller probation
    // queue so its products stay immediately storefront-visible.
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true } });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    return { token, storeId: store.body.id as string };
  }

  it("resolves a store by its free subdomain (<slug>.<platform_root_domain>)", async () => {
    const { storeId } = await signupLoginAndCreateStore("storefront-sub@example.com", "storefront-sub-store");
    const res = await request(app.getHttpServer())
      .get("/storefront/store")
      .query({ hostname: "storefront-sub-store.goto5x.com" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(storeId);
    expect(res.body.canonicalHostname).toBe("storefront-sub-store.goto5x.com");
  });

  it("an unresolvable hostname (no matching domain or subdomain) returns 404", async () => {
    const res = await request(app.getHttpServer()).get("/storefront/store").query({ hostname: "nonexistent.goto5x.com" });
    expect(res.status).toBe(404);
  });

  it("a verified custom domain takes precedence over the free subdomain as canonicalHostname", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("storefront-domain@example.com", "storefront-domain-store");
    await superuser.settingsValue.create({
      data: { definitionKey: "domains.cname_target", scopeType: "global", scopeId: null, value: "github.com" },
    });
    const attach = await request(app.getHttpServer())
      .post(`/stores/${storeId}/domains`)
      .set("Authorization", `Bearer ${token}`)
      .send({ domainName: "www.github.com" });
    expect(attach.status).toBe(201);

    // Not yet verified - the custom domain must not resolve, and the free
    // subdomain must still be canonical.
    const beforeVerify = await request(app.getHttpServer())
      .get("/storefront/store")
      .query({ hostname: "www.github.com" });
    expect(beforeVerify.status).toBe(404);

    await superuser.domain.update({ where: { id: attach.body.id }, data: { verificationStatus: "verified" } });

    const byCustomDomain = await request(app.getHttpServer())
      .get("/storefront/store")
      .query({ hostname: "www.github.com" });
    expect(byCustomDomain.status).toBe(200);
    expect(byCustomDomain.body.id).toBe(storeId);
    expect(byCustomDomain.body.canonicalHostname).toBe("www.github.com");

    // The free subdomain still resolves to the same store, but its
    // canonicalHostname now reflects the verified custom domain.
    const bySubdomain = await request(app.getHttpServer())
      .get("/storefront/store")
      .query({ hostname: "storefront-domain-store.goto5x.com" });
    expect(bySubdomain.body.id).toBe(storeId);
    expect(bySubdomain.body.canonicalHostname).toBe("www.github.com");
  });

  it("exposes accessMode on the public store response (drives apps/web's noindex/sitemap decision)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("storefront-hidden@example.com", "storefront-hidden-store");
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ accessMode: "coming_soon" });

    const res = await request(app.getHttpServer())
      .get("/storefront/store")
      .query({ hostname: "storefront-hidden-store.goto5x.com" });
    expect(res.status).toBe(200);
    expect(res.body.accessMode).toBe("coming_soon");
  });

  it("a suspended store's hostname does not resolve publicly at all", async () => {
    const { storeId } = await signupLoginAndCreateStore("storefront-suspended@example.com", "storefront-suspended-store");
    await superuser.store.update({ where: { id: storeId }, data: { status: "suspended" } });

    const res = await request(app.getHttpServer())
      .get("/storefront/store")
      .query({ hostname: "storefront-suspended-store.goto5x.com" });
    expect(res.status).toBe(404);
  });

  it("renders the SEO fallback chain end-to-end for a product with no seoTitle/seoDescription set", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("storefront-seo@example.com", "storefront-seo-store");
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ seoDescription: "Store-wide default SEO description." });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Unbranded Widget", status: "active" });

    const listRes = await request(app.getHttpServer())
      .get("/storefront/products")
      .query({ hostname: "storefront-seo-store.goto5x.com" });
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].seoTitle).toBe("Unbranded Widget"); // falls back to product title
    expect(listRes.body[0].seoDescription).toBe("Store-wide default SEO description."); // falls back to store default

    const detailRes = await request(app.getHttpServer())
      .get(`/storefront/products/${product.body.id}`)
      .query({ hostname: "storefront-seo-store.goto5x.com" });
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.seoTitle).toBe("Unbranded Widget");
  });

  it("a draft product never appears in the public storefront listing or detail endpoint", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("storefront-draft@example.com", "storefront-draft-store");
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Still a draft" }); // status defaults to "draft"

    const listRes = await request(app.getHttpServer())
      .get("/storefront/products")
      .query({ hostname: "storefront-draft-store.goto5x.com" });
    expect(listRes.body).toEqual([]);

    const detailRes = await request(app.getHttpServer())
      .get(`/storefront/products/${product.body.id}`)
      .query({ hostname: "storefront-draft-store.goto5x.com" });
    expect(detailRes.status).toBe(404);
  });

  it("a product from a different store is not reachable through another store's hostname (no cross-store leak)", async () => {
    const storeA = await signupLoginAndCreateStore("storefront-cross-a@example.com", "storefront-cross-a-store");
    const storeB = await signupLoginAndCreateStore("storefront-cross-b@example.com", "storefront-cross-b-store");
    const productA = await request(app.getHttpServer())
      .post(`/stores/${storeA.storeId}/products`)
      .set("Authorization", `Bearer ${storeA.token}`)
      .send({ title: "Store A's product", status: "active" });

    const res = await request(app.getHttpServer())
      .get(`/storefront/products/${productA.body.id}`)
      .query({ hostname: "storefront-cross-b-store.goto5x.com" });
    expect(res.status).toBe(404);
  });

  it("requires a hostname query parameter", async () => {
    const res = await request(app.getHttpServer()).get("/storefront/store");
    expect(res.status).toBe(400);
  });
});
