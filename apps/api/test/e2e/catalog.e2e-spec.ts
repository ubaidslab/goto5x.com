import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

describe("Catalog: products & variants (e2e) - SRS FR-2.1, §14.2", () => {
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
    return { token, storeId: store.body.id as string };
  }

  it("creates a product, adds a variant, and lists the product with its variant embedded (FR-2.1)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("catalog-owner@example.com", "catalog-owner-store");

    const createProduct = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Cotton T-Shirt", description: "100% cotton" });
    expect(createProduct.status).toBe(201);
    expect(createProduct.body.status).toBe("draft");
    const productId = createProduct.body.id;

    const createVariant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${productId}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "TSHIRT-M-BLUE", price: 1500, stockQuantity: 25, attributes: { size: "M", color: "blue" } });
    expect(createVariant.status).toBe(201);
    expect(createVariant.body.stockQuantity).toBe(25);

    const getProduct = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products/${productId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getProduct.status).toBe(200);
    expect(getProduct.body.variants).toHaveLength(1);
    expect(getProduct.body.variants[0].sku).toBe("TSHIRT-M-BLUE");
  });

  it("inventory tracking: updating a variant's stockQuantity persists (FR-2.1)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("inventory-owner@example.com", "inventory-store");
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Widget" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "WID-1", price: 500, stockQuantity: 10 });

    const update = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/products/${product.body.id}/variants/${variant.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ stockQuantity: 3 });
    expect(update.status).toBe(200);
    expect(update.body.stockQuantity).toBe(3);
  });

  it("deleting a product with existing variants is rejected (409) until the variants are removed first", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("delete-owner@example.com", "delete-store");
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Has A Variant" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "V-1", price: 100 });

    const blockedDelete = await request(app.getHttpServer())
      .delete(`/stores/${storeId}/products/${product.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(blockedDelete.status).toBe(409);

    await request(app.getHttpServer())
      .delete(`/stores/${storeId}/products/${product.body.id}/variants/${variant.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    const allowedDelete = await request(app.getHttpServer())
      .delete(`/stores/${storeId}/products/${product.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(allowedDelete.status).toBe(200);
  });

  it("seller A cannot read, list, or create products/variants against seller B's store (app-layer, cross-tenant)", async () => {
    const a = await signupLoginAndCreateStore("productsA@example.com", "products-store-a");
    const b = await signupLoginAndCreateStore("productsB@example.com", "products-store-b");

    const createA = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/products`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ title: "Seller A's Product" });
    const productAId = createA.body.id;

    const crossRead = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/products/${productAId}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossRead.status).toBe(404);

    const crossList = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/products`)
      .set("Authorization", `Bearer ${b.token}`);
    // RLS on `stores` denies seller B's session the ability to resolve
    // seller A's store at all, so the ownership check inside ProductsService
    // fails closed with 404 rather than an empty list.
    expect(crossList.status).toBe(404);

    const crossVariantCreate = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/products/${productAId}/variants`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ sku: "HIJACK", price: 1 });
    expect(crossVariantCreate.status).toBe(404);

    const unchanged = await superuser.product.findUniqueOrThrow({ where: { id: productAId } });
    expect(unchanged.title).toBe("Seller A's Product");
  });

  it("a seller's OWN second store cannot reach the first store's products via the URL (same-seller, cross-store boundary)", async () => {
    const { token, storeId: storeOneId } = await signupLoginAndCreateStore("multistore@example.com", "multi-store-1");
    const storeTwo = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Second Store", slug: "multi-store-2" });
    const storeTwoId = storeTwo.body.id;

    const productInStoreOne = await request(app.getHttpServer())
      .post(`/stores/${storeOneId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Belongs To Store One" });

    // Same seller, same valid JWT - but store_id in the URL doesn't match the
    // product's real store. RLS alone would allow this (same seller_id); the
    // app-layer storeId check in ProductsService is what must reject it.
    const wrongStoreRead = await request(app.getHttpServer())
      .get(`/stores/${storeTwoId}/products/${productInStoreOne.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(wrongStoreRead.status).toBe(404);
  });

  it("RLS denies cross-tenant product access at the database level, independent of the application layer", async () => {
    const sellerA = await superuser.seller.create({
      data: { businessName: "DB Products A", user: { create: { email: "db-products-a@example.com", roleFlags: ["seller"] } } },
    });
    const sellerB = await superuser.seller.create({
      data: { businessName: "DB Products B", user: { create: { email: "db-products-b@example.com", roleFlags: ["seller"] } } },
    });
    const storeA = await superuser.store.create({ data: { sellerId: sellerA.id, name: "DB Store A", slug: "db-products-store-a" } });
    const storeB = await superuser.store.create({ data: { sellerId: sellerB.id, name: "DB Store B", slug: "db-products-store-b" } });
    await superuser.product.create({ data: { storeId: storeA.id, title: "Product A" } });
    await superuser.product.create({ data: { storeId: storeB.id, title: "Product B" } });

    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const asSellerA = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerA.id}'`);
      return tx.product.findMany();
    });
    expect(asSellerA.map((p) => p.title)).toEqual(["Product A"]);

    const noContext = await runtime.$transaction((tx) => tx.product.findMany());
    expect(noContext).toEqual([]); // fail-closed, same as `stores` (Module 1)

    await runtime.$disconnect();
  });

  it("assigning a product to a real category persists; a nonexistent category is rejected", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("category-owner@example.com", "category-store");
    const category = await superuser.category.create({ data: { name: "Electronics", slug: "electronics-catalog-test" } });

    const withCategory = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Phone Case", categoryId: category.id });
    expect(withCategory.status).toBe(201);
    expect(withCategory.body.categoryId).toBe(category.id);

    const withBadCategory = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Bad Category Product", categoryId: "00000000-0000-0000-0000-000000000000" });
    expect(withBadCategory.status).toBe(404);
  });
});

describe("Product Organization at Scale (e2e) - SRS §5.57/FR-57.1-57.3 (Module 50)", () => {
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
    return { token, storeId: store.body.id as string };
  }

  it("tags: set at creation, replaced (not merged) on update, and filterable via ?tag=", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("tags-owner@example.com", "tags-store");

    const created = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Red Summer Shirt", tags: ["red", "summer"] });
    expect(created.status).toBe(201);
    expect(created.body.tags).toEqual(["red", "summer"]);
    const productId = created.body.id;

    const other = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Blue Winter Coat", tags: ["blue", "winter"] });
    expect(other.status).toBe(201);

    const filteredBySummer = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?tag=summer`)
      .set("Authorization", `Bearer ${token}`);
    expect(filteredBySummer.body.items.map((p: any) => p.id)).toEqual([productId]);

    const updated = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ tags: ["clearance"] });
    expect(updated.status).toBe(200);
    expect(updated.body.tags).toEqual(["clearance"]);

    const noLongerSummer = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?tag=summer`)
      .set("Authorization", `Bearer ${token}`);
    expect(noLongerSummer.body.items).toEqual([]);
  });

  it("search matches title and SKU; price range and category filters work; all filters compose (FR-57.3)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("filters-owner@example.com", "filters-store");
    const category = await superuser.category.create({ data: { name: "Apparel", slug: "apparel-filters-test" } });

    const shirt = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Cotton Shirt", categoryId: category.id });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${shirt.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "SHIRT-001", price: 1000, stockQuantity: 10 });

    const mug = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Ceramic Mug" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${mug.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "MUG-777", price: 5000, stockQuantity: 10 });

    const byTitle = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?search=shirt`)
      .set("Authorization", `Bearer ${token}`);
    expect(byTitle.body.items.map((p: any) => p.id)).toEqual([shirt.body.id]);

    const bySku = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?search=777`)
      .set("Authorization", `Bearer ${token}`);
    expect(bySku.body.items.map((p: any) => p.id)).toEqual([mug.body.id]);

    const byPriceRange = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?minPrice=2000&maxPrice=6000`)
      .set("Authorization", `Bearer ${token}`);
    expect(byPriceRange.body.items.map((p: any) => p.id)).toEqual([mug.body.id]);

    const byCategory = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?categoryId=${category.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(byCategory.body.items.map((p: any) => p.id)).toEqual([shirt.body.id]);

    // Composed: title search AND category - both must match the same product.
    const composed = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?search=shirt&categoryId=${category.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(composed.body.items.map((p: any) => p.id)).toEqual([shirt.body.id]);

    const composedMismatch = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?search=mug&categoryId=${category.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(composedMismatch.body.items).toEqual([]);
  });

  it("moderation-state filter matches the exact status", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("modstate-owner@example.com", "modstate-store");
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Needs Review" });
    await superuser.product.update({ where: { id: product.body.id }, data: { moderationStatus: "pending" } });

    const pendingOnly = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?moderationStatus=pending`)
      .set("Authorization", `Bearer ${token}`);
    expect(pendingOnly.body.items.map((p: any) => p.id)).toEqual([product.body.id]);

    const approvedOnly = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?moderationStatus=approved`)
      .set("Authorization", `Bearer ${token}`);
    expect(approvedOnly.body.items).toEqual([]);
  });

  it("stock status - worst-trackable-variant rule: out beats low beats in (FR-57.2)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("stock-owner@example.com", "stock-store");

    const outProduct = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Out Of Stock Item" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${outProduct.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "OUT-1", price: 100, stockQuantity: 0 });

    const lowProduct = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Low Stock Item" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${lowProduct.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "LOW-1", price: 100, stockQuantity: 3 }); // default threshold is 5

    const inProduct = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "In Stock Item" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${inProduct.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "IN-1", price: 100, stockQuantity: 50 });

    const out = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?stockStatus=out`)
      .set("Authorization", `Bearer ${token}`);
    expect(out.body.items.map((p: any) => p.id)).toEqual([outProduct.body.id]);

    const low = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?stockStatus=low`)
      .set("Authorization", `Bearer ${token}`);
    expect(low.body.items.map((p: any) => p.id)).toEqual([lowProduct.body.id]);

    const inStock = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?stockStatus=in`)
      .set("Authorization", `Bearer ${token}`);
    expect(inStock.body.items.map((p: any) => p.id)).toEqual([inProduct.body.id]);
  });

  it("pagination: page/limit/total/totalPages are correct and pages don't overlap", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("paged-owner@example.com", "paged-store");
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: `Product ${i}` });
    }

    const pageOne = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?page=1&limit=2`)
      .set("Authorization", `Bearer ${token}`);
    expect(pageOne.body).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(pageOne.body.items).toHaveLength(2);

    const pageTwo = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?page=2&limit=2`)
      .set("Authorization", `Bearer ${token}`);
    expect(pageTwo.body.items).toHaveLength(2);
    const pageOneIds = pageOne.body.items.map((p: any) => p.id);
    const pageTwoIds = pageTwo.body.items.map((p: any) => p.id);
    expect(pageOneIds.some((id: string) => pageTwoIds.includes(id))).toBe(false);

    const pageThree = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?page=3&limit=2`)
      .set("Authorization", `Bearer ${token}`);
    expect(pageThree.body.items).toHaveLength(1);

    const pageFour = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products?page=4&limit=2`)
      .set("Authorization", `Bearer ${token}`);
    expect(pageFour.body.items).toEqual([]);
    expect(pageFour.body.total).toBe(5);
  });
});

describe("Product Custom Attributes (e2e) - SRS §5.69/FR-69.1-69.4 (Module 94)", () => {
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
    // Module 6 (SRS §5.27/FR-27.1) - an untrusted seller's new listings are
    // queued for moderation (moderationStatus "pending"), which fails the
    // storefront's PUBLIC_MODERATION_STATUSES check - trusted here so the
    // FR-69.3 storefront-visibility test below reflects the common case,
    // same setup module15's checkoutAndPay()-based tests already use.
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true } });
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  it("FR-69.1: set at creation, replaced (not merged) on update", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("attrs-owner@example.com", "attrs-store");

    const created = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Canvas Tote", customAttributes: [{ key: "Material", value: "100% Cotton" }, { key: "Weight", value: "250g" }] });
    expect(created.status).toBe(201);
    expect(created.body.customAttributes).toEqual([{ key: "Material", value: "100% Cotton" }, { key: "Weight", value: "250g" }]);

    const updated = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/products/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ customAttributes: [{ key: "Country of Origin", value: "Pakistan" }] });
    expect(updated.status).toBe(200);
    // Replaced wholesale - "Material"/"Weight" are gone, not merged with the new pair.
    expect(updated.body.customAttributes).toEqual([{ key: "Country of Origin", value: "Pakistan" }]);
  });

  it("FR-69.1: rejects duplicate keys (case-insensitive), an empty key, and more than 20 pairs", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("attrs-dup@example.com", "attrs-dup-store");

    const dup = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Product", customAttributes: [{ key: "Material", value: "Cotton" }, { key: "material", value: "Wool" }] });
    expect(dup.status).toBe(400);

    const emptyKey = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Product", customAttributes: [{ key: "", value: "Cotton" }] });
    expect(emptyKey.status).toBe(400);

    const tooMany = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Product", customAttributes: Array.from({ length: 21 }, (_, i) => ({ key: `k${i}`, value: `v${i}` })) });
    expect(tooMany.status).toBe(400);
  });

  it("FR-69.3: buyer-facing by default on the storefront, absent when a product has none, never affects variants/price/stock (FR-69.4)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("attrs-storefront@example.com", "attrs-storefront-store");

    const withAttrs = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Classic Tee", status: "active", customAttributes: [{ key: "Material", value: "100% Cotton" }] });
    const withoutAttrs = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Plain Mug", status: "active" });

    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${withAttrs.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "TEE-1", price: 1500, stockQuantity: 10 });
    expect(variant.status).toBe(201);

    const publicWithAttrs = await request(app.getHttpServer()).get(
      `/storefront/products/${withAttrs.body.id}?hostname=${hostname}`,
    );
    expect(publicWithAttrs.status).toBe(200);
    expect(publicWithAttrs.body.customAttributes).toEqual([{ key: "Material", value: "100% Cotton" }]);
    // No variant/price/stock interaction - the variant just created exists independently.
    expect(publicWithAttrs.body.variants).toHaveLength(1);
    expect(publicWithAttrs.body.variants[0].sku).toBe("TEE-1");

    const publicWithoutAttrs = await request(app.getHttpServer()).get(
      `/storefront/products/${withoutAttrs.body.id}?hostname=${hostname}`,
    );
    expect(publicWithoutAttrs.body.customAttributes).toEqual([]);
  });

  it("Tenant isolation: a seller cannot set custom attributes on another store's product", async () => {
    const sellerA = await signupLoginAndCreateStore("attrs-iso-a@example.com", "attrs-iso-a-store");
    const sellerB = await signupLoginAndCreateStore("attrs-iso-b@example.com", "attrs-iso-b-store");

    const product = await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/products`)
      .set("Authorization", `Bearer ${sellerA.token}`)
      .send({ title: "Seller A's Product" });

    const crossUpdate = await request(app.getHttpServer())
      .patch(`/stores/${sellerA.storeId}/products/${product.body.id}`)
      .set("Authorization", `Bearer ${sellerB.token}`)
      .send({ customAttributes: [{ key: "Hacked", value: "true" }] });
    expect(crossUpdate.status).toBe(404);
  });
});
