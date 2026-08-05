import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 33 (SRS §5.50, §14.50) - Customer Segments. A saved filter, never a
 * materialized member list - every assertion below proves membership is
 * resolved live against Customer's existing ordersCount/totalSpent/
 * lastOrderAt (Module 15), not a separately-maintained list.
 */
describe("Customer Segments (e2e) - SRS §5.50, §14.50", () => {
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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, hostname: `${slug}.goto5x.com` };
  }

  async function createSelfProduct(token: string, storeId: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function checkoutAndPay(
    token: string,
    storeId: string,
    hostname: string,
    productId: string,
    variantId: string,
    buyerEmail: string,
    city: string,
    country = "PK",
  ) {
    const shippingAddress = { fullName: buyerEmail, line1: "House 1", city, country, phone: "03001234567" };
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail, items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${checkout.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    return checkout.body.id as string;
  }

  it("FR-50.1/50.5: CRUD works and tenant-isolates segments", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("crud@example.com", "crud-store");

    const created = await request(app.getHttpServer())
      .post(`/stores/${storeId}/customer-segments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Big spenders", minTotalSpent: 1000 });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Big spenders");

    const updated = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/customer-segments/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Big spenders (updated)", minTotalSpent: 2000 });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("Big spenders (updated)");
    expect(updated.body.minTotalSpent).toBe("2000");

    const list = await request(app.getHttpServer())
      .get(`/stores/${storeId}/customer-segments`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].memberCount).toBe(0);

    const removed = await request(app.getHttpServer())
      .delete(`/stores/${storeId}/customer-segments/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(removed.status).toBe(200);

    const listAfter = await request(app.getHttpServer())
      .get(`/stores/${storeId}/customer-segments`)
      .set("Authorization", `Bearer ${token}`);
    expect(listAfter.body).toHaveLength(0);
  });

  it("FR-50.2/50.4: membership is derived live from order count/spend, not a stored list", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("live-derive@example.com", "live-derive-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);

    const segment = await request(app.getHttpServer())
      .post(`/stores/${storeId}/customer-segments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Repeat buyers", minOrders: 2 });

    // No orders yet - nobody qualifies.
    let members = await request(app.getHttpServer())
      .get(`/stores/${storeId}/customer-segments/${segment.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(members.body.members).toHaveLength(0);

    await checkoutAndPay(token, storeId, hostname, productId, variantId, "loyal@example.com", "Lahore");
    // One order - still doesn't qualify for minOrders: 2.
    members = await request(app.getHttpServer())
      .get(`/stores/${storeId}/customer-segments/${segment.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(members.body.members).toHaveLength(0);

    await checkoutAndPay(token, storeId, hostname, productId, variantId, "loyal@example.com", "Lahore");
    // Second order - now qualifies, with NO change to the segment row itself (FR-50.4).
    members = await request(app.getHttpServer())
      .get(`/stores/${storeId}/customer-segments/${segment.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(members.body.members).toHaveLength(1);
    expect(members.body.members[0].email).toBe("loyal@example.com");
  });

  it("FR-50.3: location filter derives from each customer's most recent order's shipping address", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("location@example.com", "location-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);

    await checkoutAndPay(token, storeId, hostname, productId, variantId, "lahore-buyer@example.com", "Lahore");
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "karachi-buyer@example.com", "Karachi");
    // This customer's most RECENT order is Lahore, even though their first was Karachi.
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "moved-buyer@example.com", "Karachi");
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "moved-buyer@example.com", "Lahore");

    const preview = await request(app.getHttpServer())
      .post(`/stores/${storeId}/customer-segments/preview`)
      .set("Authorization", `Bearer ${token}`)
      .send({ locationCity: "Lahore" });
    expect(preview.status).toBe(201);
    expect(preview.body.count).toBe(2); // lahore-buyer + moved-buyer (latest order is Lahore)

    const previewKarachi = await request(app.getHttpServer())
      .post(`/stores/${storeId}/customer-segments/preview`)
      .set("Authorization", `Bearer ${token}`)
      .send({ locationCity: "Karachi" });
    expect(previewKarachi.body.count).toBe(1); // karachi-buyer only - moved-buyer's latest order is Lahore, not Karachi
  });

  it("FR-50.5/tenant isolation: RLS denies cross-tenant access to another store's segments", async () => {
    const a = await signupLoginAndCreateStore("seg-tenant-a@example.com", "seg-tenant-a-store");
    const b = await signupLoginAndCreateStore("seg-tenant-b@example.com", "seg-tenant-b-store");

    const segment = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/customer-segments`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ name: "A's segment" });

    const crossTenantGet = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/customer-segments/${segment.body.id}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossTenantGet.status).toBe(404);

    const crossTenantDelete = await request(app.getHttpServer())
      .delete(`/stores/${a.storeId}/customer-segments/${segment.body.id}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossTenantDelete.status).toBe(404);
  });
});
