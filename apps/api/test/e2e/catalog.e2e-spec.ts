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
