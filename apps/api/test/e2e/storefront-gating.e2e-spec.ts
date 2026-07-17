import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS FR-16.1/16.2/16.5, §14.16 - the public storefront's search/collections/
 * categories endpoints, and the coming-soon/password-protected access gate
 * (enforced in the API itself per the mobile-app-readiness NFR, not only in
 * apps/web).
 */
describe("Storefront: search, collections, and the access gate (e2e) - SRS FR-16.2/16.5, §14.16", () => {
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

  async function createActiveProduct(token: string, storeId: string, title: string, description?: string) {
    const res = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title, description, status: "active" });
    return res.body.id as string;
  }

  it("full-text search returns relevant results and an unmatched category filter narrows to nothing (FR-16.2)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("search@example.com", "search-store");
    const hostname = "search-store.goto5x.com";

    const wireless = await createActiveProduct(token, storeId, "Wireless Headphones", "Great sound, no wires.");
    await createActiveProduct(token, storeId, "Wired Earbuds", "Budget-friendly wired option.");

    const searchRes = await request(app.getHttpServer())
      .get("/storefront/search")
      .query({ hostname, q: "wireless" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.map((p: any) => p.id)).toEqual([wireless]);

    const noMatch = await request(app.getHttpServer())
      .get("/storefront/search")
      .query({ hostname, q: "nonexistentquery12345" });
    expect(noMatch.body).toEqual([]);

    const byCategory = await request(app.getHttpServer())
      .get("/storefront/search")
      .query({ hostname, categoryId: "00000000-0000-4000-8000-000000000000" });
    expect(byCategory.body).toEqual([]);
  });

  it("search respects a min/max price range against variant prices", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("search-price@example.com", "search-price-store");
    const hostname = "search-price-store.goto5x.com";
    const cheap = await createActiveProduct(token, storeId, "Cheap Widget");
    const pricey = await createActiveProduct(token, storeId, "Pricey Widget");
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${cheap}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "CHEAP-1", price: 10, stockQuantity: 5 });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${pricey}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "PRICEY-1", price: 500, stockQuantity: 5 });

    const res = await request(app.getHttpServer())
      .get("/storefront/search")
      .query({ hostname, minPrice: "1", maxPrice: "50" });
    expect(res.body.map((p: any) => p.id)).toEqual([cheap]);
  });

  it("a collection renders its assigned products on the storefront in sort order (FR-16.1)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("sf-collections@example.com", "sf-collections-store");
    const hostname = "sf-collections-store.goto5x.com";
    const collection = await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Featured", slug: "featured" });
    const first = await createActiveProduct(token, storeId, "First Product");
    const second = await createActiveProduct(token, storeId, "Second Product");
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections/${collection.body.id}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: second, sortOrder: 0 });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections/${collection.body.id}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: first, sortOrder: 1 });

    const listRes = await request(app.getHttpServer()).get("/storefront/collections").query({ hostname });
    expect(listRes.body).toHaveLength(1);

    const detailRes = await request(app.getHttpServer())
      .get(`/storefront/collections/${collection.body.id}`)
      .query({ hostname });
    expect(detailRes.body.products.map((p: any) => p.id)).toEqual([second, first]);
  });

  it("an inactive collection is not publicly reachable", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("sf-inactive-collection@example.com", "sf-inactive-collection-store");
    const hostname = "sf-inactive-collection-store.goto5x.com";
    const collection = await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Hidden", slug: "hidden", isActive: false });

    const listRes = await request(app.getHttpServer()).get("/storefront/collections").query({ hostname });
    expect(listRes.body).toEqual([]);

    const detailRes = await request(app.getHttpServer())
      .get(`/storefront/collections/${collection.body.id}`)
      .query({ hostname });
    expect(detailRes.status).toBe(404);
  });

  it("returns the store's own header/footer navigation publicly, isolated from other stores", async () => {
    const a = await signupLoginAndCreateStore("sf-nav-a@example.com", "sf-nav-a-store");
    await signupLoginAndCreateStore("sf-nav-b@example.com", "sf-nav-b-store");
    await request(app.getHttpServer())
      .put(`/stores/${a.storeId}/navigation/header`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ items: [{ type: "link", label: "Shop", targetType: "external", url: "/shop" }] });

    const resA = await request(app.getHttpServer())
      .get("/storefront/navigation")
      .query({ hostname: "sf-nav-a-store.goto5x.com" });
    expect(resA.body.header).toHaveLength(1);

    const resB = await request(app.getHttpServer())
      .get("/storefront/navigation")
      .query({ hostname: "sf-nav-b-store.goto5x.com" });
    expect(resB.body.header).toEqual([]);
  });

  it("lists only the categories actually used by this store's active products", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("sf-categories@example.com", "sf-categories-store");
    const hostname = "sf-categories-store.goto5x.com";
    const category = await superuser.category.create({ data: { name: "Gadgets", slug: `gadgets-${Date.now()}` } });
    const product = await createActiveProduct(token, storeId, "Gadget One");
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/products/${product}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ categoryId: category.id });

    const res = await request(app.getHttpServer()).get("/storefront/categories").query({ hostname });
    expect(res.body).toEqual([{ id: category.id, name: "Gadgets", slug: category.slug }]);
  });

  it("a coming_soon store blocks products/search/collections but getStorePublic still works (FR-16.5)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("gate-coming-soon@example.com", "gate-coming-soon-store");
    const hostname = "gate-coming-soon-store.goto5x.com";
    await createActiveProduct(token, storeId, "Hidden Product");
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ accessMode: "coming_soon" });

    const storeRes = await request(app.getHttpServer()).get("/storefront/store").query({ hostname });
    expect(storeRes.status).toBe(200);
    expect(storeRes.body.accessMode).toBe("coming_soon");

    const productsRes = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(productsRes.status).toBe(403);

    const searchRes = await request(app.getHttpServer()).get("/storefront/search").query({ hostname });
    expect(searchRes.status).toBe(403);

    const collectionsRes = await request(app.getHttpServer()).get("/storefront/collections").query({ hostname });
    expect(collectionsRes.status).toBe(403);
  });

  it("requires a password before switching accessMode to password_protected", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("gate-no-password@example.com", "gate-no-password-store");
    const res = await request(app.getHttpServer())
      .patch(`/stores/${storeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ accessMode: "password_protected" });
    expect(res.status).toBe(400);
  });

  it("a password_protected store blocks products until a correct-password unlock token is supplied (FR-16.5)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("gate-password@example.com", "gate-password-store");
    const hostname = "gate-password-store.goto5x.com";
    await createActiveProduct(token, storeId, "Gated Product");
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ accessMode: "password_protected", accessPassword: "letmein123" });

    const blocked = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(blocked.status).toBe(403);

    const wrongPassword = await request(app.getHttpServer())
      .post("/storefront/unlock")
      .send({ hostname, password: "wrong-password" });
    expect(wrongPassword.status).toBe(401);

    const unlock = await request(app.getHttpServer())
      .post("/storefront/unlock")
      .send({ hostname, password: "letmein123" });
    expect(unlock.status).toBe(201);
    const unlockToken = unlock.body.unlockToken as string;
    expect(typeof unlockToken).toBe("string");

    const unlocked = await request(app.getHttpServer())
      .get("/storefront/products")
      .query({ hostname, unlockToken });
    expect(unlocked.status).toBe(200);
    expect(unlocked.body).toHaveLength(1);

    // An unlock token for a DIFFERENT store must not work here.
    const other = await signupLoginAndCreateStore("gate-password-other@example.com", "gate-password-other-store");
    await request(app.getHttpServer())
      .patch(`/stores/${other.storeId}`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ accessMode: "password_protected", accessPassword: "someotherpassword" });
    const otherUnlock = await request(app.getHttpServer())
      .post("/storefront/unlock")
      .send({ hostname: "gate-password-other-store.goto5x.com", password: "someotherpassword" });
    const crossToken = await request(app.getHttpServer())
      .get("/storefront/products")
      .query({ hostname, unlockToken: otherUnlock.body.unlockToken });
    expect(crossToken.status).toBe(403);
  });

  it("never returns accessPasswordHash in any store API response", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("no-hash-leak@example.com", "no-hash-leak-store");
    const update = await request(app.getHttpServer())
      .patch(`/stores/${storeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ accessMode: "password_protected", accessPassword: "supersecretpassword" });
    expect(update.status).toBe(200);
    expect(update.body.accessPasswordHash).toBeUndefined();
    expect(JSON.stringify(update.body)).not.toContain("supersecretpassword");

    const getOne = await request(app.getHttpServer())
      .get(`/stores/${storeId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getOne.body.accessPasswordHash).toBeUndefined();

    const list = await request(app.getHttpServer()).get("/stores").set("Authorization", `Bearer ${token}`);
    expect(list.body[0].accessPasswordHash).toBeUndefined();
  });
});
