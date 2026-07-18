import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS FR-16.1/FR-16.3, §14.16 - seller-facing Collections CRUD (incl.
 * product assignment/reorder) and the header/footer navigation editor,
 * plus tenant isolation on both.
 */
describe("Discovery & Merchandising: Collections + Navigation (e2e) - SRS FR-16.x, §14.16", () => {
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

  it("creates, lists, updates, and deletes a collection (FR-16.1)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("discovery-crud@example.com", "discovery-crud-store");

    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Summer Sale", slug: "summer-sale" });
    expect(create.status).toBe(201);
    const collectionId = create.body.id;

    const list = await request(app.getHttpServer())
      .get(`/stores/${storeId}/collections`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body).toHaveLength(1);

    const update = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/collections/${collectionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Winter Sale" });
    expect(update.status).toBe(200);
    expect(update.body.title).toBe("Winter Sale");

    const remove = await request(app.getHttpServer())
      .delete(`/stores/${storeId}/collections/${collectionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(remove.status).toBe(200);

    const listAfter = await request(app.getHttpServer())
      .get(`/stores/${storeId}/collections`)
      .set("Authorization", `Bearer ${token}`);
    expect(listAfter.body).toHaveLength(0);
  });

  it("rejects a duplicate slug within the same store, but the same slug is fine in a different store", async () => {
    const a = await signupLoginAndCreateStore("discovery-slug-a@example.com", "discovery-slug-a-store");
    const b = await signupLoginAndCreateStore("discovery-slug-b@example.com", "discovery-slug-b-store");

    const first = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/collections`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ title: "Sale", slug: "sale" });
    expect(first.status).toBe(201);

    const dupe = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/collections`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ title: "Another Sale", slug: "sale" });
    expect(dupe.status).toBe(409);

    const otherStoreSameSlug = await request(app.getHttpServer())
      .post(`/stores/${b.storeId}/collections`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ title: "Sale", slug: "sale" });
    expect(otherStoreSameSlug.status).toBe(201);
  });

  it("adds, reorders, and removes products in a collection (FR-16.1)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("discovery-products@example.com", "discovery-products-store");
    const collection = await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Featured", slug: "featured" });
    const productA = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Product A" });
    const productB = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Product B" });

    const addA = await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections/${collection.body.id}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: productA.body.id, sortOrder: 0 });
    expect(addA.status).toBe(201);

    const addDuplicate = await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections/${collection.body.id}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: productA.body.id });
    expect(addDuplicate.status).toBe(409);

    await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections/${collection.body.id}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: productB.body.id, sortOrder: 1 });

    const reorder = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/collections/${collection.body.id}/products/${productB.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sortOrder: 0 });
    expect(reorder.status).toBe(200);
    expect(reorder.body.sortOrder).toBe(0);

    const removed = await request(app.getHttpServer())
      .delete(`/stores/${storeId}/collections/${collection.body.id}/products/${productA.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(removed.status).toBe(200);

    const getOne = await request(app.getHttpServer())
      .get(`/stores/${storeId}/collections/${collection.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getOne.body.products).toHaveLength(1);
    expect(getOne.body.products[0].productId).toBe(productB.body.id);
  });

  it("a collection cannot reference another store's product (app-layer enforcement)", async () => {
    const a = await signupLoginAndCreateStore("discovery-cross-a@example.com", "discovery-cross-a-store");
    const b = await signupLoginAndCreateStore("discovery-cross-b@example.com", "discovery-cross-b-store");
    const collection = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/collections`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ title: "A's collection", slug: "as-collection" });
    const productB = await request(app.getHttpServer())
      .post(`/stores/${b.storeId}/products`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ title: "B's product" });

    const res = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/collections/${collection.body.id}/products`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ productId: productB.body.id });
    expect(res.status).toBe(404);
  });

  it("seller A cannot read or update seller B's collections via the API (app-layer enforcement)", async () => {
    const a = await signupLoginAndCreateStore("discovery-tenant-a@example.com", "discovery-tenant-a-store");
    const b = await signupLoginAndCreateStore("discovery-tenant-b@example.com", "discovery-tenant-b-store");
    const collection = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/collections`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ title: "A's collection", slug: "as-collection" });

    const crossRead = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/collections/${collection.body.id}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossRead.status).toBe(404);

    const crossUpdate = await request(app.getHttpServer())
      .patch(`/stores/${a.storeId}/collections/${collection.body.id}`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ title: "Hijacked" });
    expect(crossUpdate.status).toBe(404);

    const unchanged = await superuser.collection.findUniqueOrThrow({ where: { id: collection.body.id } });
    expect(unchanged.title).toBe("A's collection");
  });

  it("RLS denies cross-tenant access to collections at the database level, independent of the app layer", async () => {
    const sellerA = await superuser.seller.create({
      data: { businessName: "DB-level A", user: { create: { email: "discovery-db-a@example.com", roleFlags: ["seller"] } } },
    });
    const sellerB = await superuser.seller.create({
      data: { businessName: "DB-level B", user: { create: { email: "discovery-db-b@example.com", roleFlags: ["seller"] } } },
    });
    const storeA = await superuser.store.create({ data: { sellerId: sellerA.id, name: "DB Store A", slug: "discovery-db-store-a" } });
    await superuser.store.create({ data: { sellerId: sellerB.id, name: "DB Store B", slug: "discovery-db-store-b" } });
    await superuser.collection.create({ data: { storeId: storeA.id, title: "A's collection", slug: "as-collection" } });

    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const asSellerB = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerB.id}'`);
      return tx.collection.findMany();
    });
    expect(asSellerB).toEqual([]);

    const noContext = await runtime.$transaction(async (tx) => tx.collection.findMany());
    expect(noContext).toEqual([]); // fail-closed

    await runtime.$disconnect();
  });

  it("gets and upserts header/footer navigation, including text_block and social_links items (FR-16.3)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("discovery-nav@example.com", "discovery-nav-store");

    const emptyGet = await request(app.getHttpServer())
      .get(`/stores/${storeId}/navigation/header`)
      .set("Authorization", `Bearer ${token}`);
    expect(emptyGet.status).toBe(200);
    expect(emptyGet.body.items).toEqual([]);

    const items = [
      { type: "link", label: "Home", targetType: "external", url: "/" },
      { type: "text_block", body: "We ship worldwide." },
      { type: "social_links", body: { facebook: "https://facebook.com/store", instagram: "https://instagram.com/store" } },
    ];
    const upsert = await request(app.getHttpServer())
      .put(`/stores/${storeId}/navigation/footer`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items });
    expect(upsert.status).toBe(200);

    const get = await request(app.getHttpServer())
      .get(`/stores/${storeId}/navigation/footer`)
      .set("Authorization", `Bearer ${token}`);
    expect(get.body.items).toEqual(items);

    // Upserting again replaces, never accumulates.
    const secondUpsert = await request(app.getHttpServer())
      .put(`/stores/${storeId}/navigation/footer`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [items[0]] });
    expect(secondUpsert.status).toBe(200);
    const getAfter = await request(app.getHttpServer())
      .get(`/stores/${storeId}/navigation/footer`)
      .set("Authorization", `Bearer ${token}`);
    expect(getAfter.body.items).toHaveLength(1);
  });

  it("rejects an invalid navigation location", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("discovery-nav-invalid@example.com", "discovery-nav-invalid-store");
    const res = await request(app.getHttpServer())
      .get(`/stores/${storeId}/navigation/sidebar`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("seller A cannot read or overwrite seller B's navigation menus (app-layer enforcement)", async () => {
    const a = await signupLoginAndCreateStore("discovery-nav-tenant-a@example.com", "discovery-nav-tenant-a-store");
    const b = await signupLoginAndCreateStore("discovery-nav-tenant-b@example.com", "discovery-nav-tenant-b-store");
    await request(app.getHttpServer())
      .put(`/stores/${a.storeId}/navigation/header`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ items: [{ type: "link", label: "A's link", targetType: "external", url: "/a" }] });

    const crossRead = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/navigation/header`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossRead.status).toBe(404);

    const crossWrite = await request(app.getHttpServer())
      .put(`/stores/${a.storeId}/navigation/header`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ items: [] });
    expect(crossWrite.status).toBe(404);

    const unchanged = await superuser.storeNavigationMenu.findFirstOrThrow({ where: { storeId: a.storeId } });
    expect((unchanged.items as any[])[0].label).toBe("A's link");
  });
});
