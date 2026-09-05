import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * FR-66.6 (Module 86) - stock-countdown urgency indicator. No new tracked
 * field: reuses Module 28's existing `inventory.low_stock_threshold`
 * (already computed for the seller's own Inventory screen/low-stock email)
 * and the storefront's already-public `variants[].stockQuantity`. This
 * only tests the one new surface: the threshold itself now being exposed
 * on the public store payload so the storefront can decide when to show
 * "Only N left!" without a second endpoint.
 */
describe("Stock-countdown urgency indicator (e2e) - FR-66.6 (Module 86)", () => {
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
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  it("the public store payload exposes the platform default low-stock threshold", async () => {
    const { hostname } = await signupLoginAndCreateStore("stockcountdown-default@example.com", "stockcountdown-default-store");
    const res = await request(app.getHttpServer()).get("/storefront/store").query({ hostname });
    expect(res.status).toBe(200);
    expect(res.body.lowStockThreshold).toBe(5);
  });

  it("a store-level override of inventory.low_stock_threshold is reflected on the public store payload", async () => {
    const { storeId, hostname } = await signupLoginAndCreateStore("stockcountdown-override@example.com", "stockcountdown-override-store");
    await superuser.settingsValue.create({
      data: { definitionKey: "inventory.low_stock_threshold", scopeType: "store", scopeId: storeId, value: 20 },
    });

    const res = await request(app.getHttpServer()).get("/storefront/store").query({ hostname });
    expect(res.status).toBe(200);
    expect(res.body.lowStockThreshold).toBe(20);
  });

  it("a product's variant stock quantity (already public) stays consistent with the threshold - a variant at the threshold is still visibly in range", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("stockcountdown-variant@example.com", "stockcountdown-variant-store");
    await superuser.seller.update({
      where: { id: (await superuser.store.findUniqueOrThrow({ where: { id: storeId } })).sellerId },
      data: { isTrusted: true },
    });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Low Stock Widget", status: "active" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}`, price: 50, stockQuantity: 3 });

    const [storeRes, productRes] = await Promise.all([
      request(app.getHttpServer()).get("/storefront/store").query({ hostname }),
      request(app.getHttpServer()).get(`/storefront/products/${product.body.id}`).query({ hostname }),
    ]);
    expect(storeRes.body.lowStockThreshold).toBe(5);
    expect(productRes.body.variants[0]).toMatchObject({ stockQuantity: 3, trackInventory: true });
  });
});
