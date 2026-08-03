import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 29 (SRS §5.40/§14.40) - Delivery-Time Badges. No new data: this is
 * the first time `StorefrontService`'s existing supplier-transparency
 * payload (Module 8, FR-4.6) is surfaced on the search and collection-detail
 * read paths, not just the plain product list/detail paths that already
 * exposed it.
 */
describe("Delivery-Time Badges (e2e) - SRS §5.40, §14.40", () => {
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
    return { token, storeId: store.body.id as string };
  }

  async function signupLoginSupplier(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Supplier ${email}`, role: "supplier" });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    return login.body.accessToken as string;
  }

  /** Same seeding precedent as suppliers.e2e-spec.ts - bypasses the real sync mechanism (unit-tested separately). */
  async function seedSupplierListing(supplierEmail: string, title: string) {
    const user = await superuser.user.findUniqueOrThrow({ where: { email: supplierEmail }, include: { supplier: true } });
    return superuser.supplierListing.create({
      data: {
        supplierId: user.supplier!.id,
        adapterType: "printify",
        externalProductId: `ext-${Date.now()}`,
        title,
        price: 12.5,
        shippingCost: 5,
        estimatedDeliveryMinDays: 7,
        estimatedDeliveryMaxDays: 14,
        supportedCountries: ["PK"],
        rawPayload: {},
      },
    });
  }

  /** Creates a live, storefront-visible supplier-sourced product via the real supplier-link/review/approve flow. */
  async function createSupplierSourcedProduct(sellerToken: string, storeId: string, storeSlug: string, title: string) {
    const supplierEmail = `supplier-${Date.now()}-${Math.random()}@example.com`;
    const supplierToken = await signupLoginSupplier(supplierEmail);
    const listing = await seedSupplierListing(supplierEmail, title);

    const linkRes = await request(app.getHttpServer())
      .post("/supplier/store-links")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSlug });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/supplier-links/${linkRes.body.id}/approve`)
      .set("Authorization", `Bearer ${sellerToken}`);

    const submit = await request(app.getHttpServer())
      .post("/supplier/listings/submit-review")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSupplierLinkId: linkRes.body.id, supplierListingId: listing.id });
    const approve = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`)
      .set("Authorization", `Bearer ${sellerToken}`);
    return approve.body.product.id as string;
  }

  /** Same `isTrusted` precedent used across this suite (e.g. module15/module26 e2e specs) to skip the new-seller probation moderation queue - not this module's concern. */
  async function createSelfFulfilledProduct(sellerToken: string, storeId: string, title: string) {
    const store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    await superuser.seller.update({ where: { id: store.sellerId }, data: { isTrusted: true } });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ title, status: "active" });
    return product.body.id as string;
  }

  it("FR-40.1: search results carry supplier delivery-transparency data for supplier-sourced items", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("badge-search-seller@example.com", "badge-search-store");
    const hostname = "badge-search-store.goto5x.com";
    const productId = await createSupplierSourcedProduct(token, storeId, "badge-search-store", "Delivery Badge Search Mug");

    const results = await request(app.getHttpServer())
      .get("/storefront/search")
      .query({ hostname, q: "Delivery Badge Search Mug" });
    expect(results.status).toBe(200);
    expect(results.body.map((p: any) => p.id)).toEqual([productId]);
    expect(results.body[0].supplierShipping).toMatchObject({
      estimatedDeliveryMinDays: 7,
      estimatedDeliveryMaxDays: 14,
      supportedCountries: ["PK"],
    });
  });

  it("FR-40.1: collection contents carry supplier delivery-transparency data for supplier-sourced items", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("badge-coll-seller@example.com", "badge-coll-store");
    const hostname = "badge-coll-store.goto5x.com";
    const productId = await createSupplierSourcedProduct(token, storeId, "badge-coll-store", "Delivery Badge Collection Mug");

    const collection = await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Badge Test Collection", slug: "badge-test-collection" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections/${collection.body.id}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId });

    const view = await request(app.getHttpServer())
      .get(`/storefront/collections/${collection.body.id}`)
      .query({ hostname });
    expect(view.status).toBe(200);
    expect(view.body.products).toHaveLength(1);
    expect(view.body.products[0].supplierShipping).toMatchObject({
      estimatedDeliveryMinDays: 7,
      estimatedDeliveryMaxDays: 14,
      supportedCountries: ["PK"],
    });
  });

  it("FR-40.2: a self-fulfilled product (no supplier listing) shows supplierShipping: null on every read surface, never an invented estimate", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("badge-self-seller@example.com", "badge-self-store");
    const hostname = "badge-self-store.goto5x.com";
    const productId = await createSelfFulfilledProduct(token, storeId, "Self-Fulfilled Badge Widget");

    const collection = await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Self Collection", slug: "self-collection" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/collections/${collection.body.id}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId });

    const list = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(list.body[0].supplierShipping).toBeNull();

    const detail = await request(app.getHttpServer()).get(`/storefront/products/${productId}`).query({ hostname });
    expect(detail.body.supplierShipping).toBeNull();

    const search = await request(app.getHttpServer())
      .get("/storefront/search")
      .query({ hostname, q: "Self-Fulfilled Badge Widget" });
    expect(search.body[0].supplierShipping).toBeNull();

    const collectionView = await request(app.getHttpServer())
      .get(`/storefront/collections/${collection.body.id}`)
      .query({ hostname });
    expect(collectionView.body.products[0].supplierShipping).toBeNull();
  });
});
