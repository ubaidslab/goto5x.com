import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const shippingAddress = { fullName: "Buyer", line1: "House 1", city: "Lahore", country: "PK", phone: "03001234567" };

/**
 * Module 54 (SRS §5.61/FR-61.1-61.7) - Analytics Depth, seller-facing.
 * Founder's explicit ask, per the FR text: top products, sales over time,
 * repeat-customer rate, return rate (overall + per product), AOV, and best
 * sales days/times - every figure gated by the Financial Truth Invariant
 * (FR-61.7), proven here against a known seeded order set, not asserted.
 */
describe("Analytics Depth (e2e) - SRS §5.61/§14.60 (Module 54)", () => {
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
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId, hostname: `${slug}.uzeyn.com` };
  }

  async function createSelfProduct(token: string, storeId: string, title: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title, status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  /** Places (and, unless payNow is false, pays for) one order via storefront checkout. */
  async function placeOrder(
    token: string,
    storeId: string,
    hostname: string,
    productId: string,
    variantId: string,
    quantity: number,
    buyerEmail: string,
    payNow = true,
  ) {
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail, items: [{ productId, variantId, quantity }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    if (payNow) {
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${checkout.body.id}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
    }
    const detail = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders/${checkout.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    return { orderId: checkout.body.id as string, token: detail.body.statusLookupToken as string, totalAmount: Number(detail.body.totalAmount) };
  }

  it("FR-61.1: top products ranks correctly by revenue and by units", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("top-products@example.com", "top-products-store");
    // Widget: 1 order x 2 units @ 100 = 200 revenue, 2 units.
    const widget = await createSelfProduct(token, storeId, "Widget", 100);
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 2, "buyer1@example.com");
    // Gadget: 3 orders x 1 unit @ 10 = 30 revenue, 3 units - more units, less revenue than Widget.
    const gadget = await createSelfProduct(token, storeId, "Gadget", 10);
    await placeOrder(token, storeId, hostname, gadget.productId, gadget.variantId, 1, "buyer2@example.com");
    await placeOrder(token, storeId, hostname, gadget.productId, gadget.variantId, 1, "buyer3@example.com");
    await placeOrder(token, storeId, hostname, gadget.productId, gadget.variantId, 1, "buyer4@example.com");

    const byRevenue = await request(app.getHttpServer())
      .get(`/stores/${storeId}/analytics/top-products?by=revenue`)
      .set("Authorization", `Bearer ${token}`);
    expect(byRevenue.status).toBe(200);
    expect(byRevenue.body[0].productTitle).toBe("Widget");
    expect(byRevenue.body[0].revenue).toBe(200);
    expect(byRevenue.body[1].revenue).toBe(30);

    const byUnits = await request(app.getHttpServer())
      .get(`/stores/${storeId}/analytics/top-products?by=units`)
      .set("Authorization", `Bearer ${token}`);
    expect(byUnits.status).toBe(200);
    expect(byUnits.body[0].productTitle).toBe("Gadget");
    expect(byUnits.body[0].units).toBe(3);
  });

  it("FR-61.2: sales over time buckets by day and sums revenue correctly", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("sales-over-time@example.com", "sales-over-time-store");
    const widget = await createSelfProduct(token, storeId, "Widget", 100);
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "buyer1@example.com");
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "buyer2@example.com");

    const res = await request(app.getHttpServer())
      .get(`/stores/${storeId}/analytics/sales-over-time?bucket=day`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const todayBucket = res.body[res.body.length - 1];
    expect(todayBucket.orderCount).toBe(2);
    expect(todayBucket.revenue).toBe(200);
  });

  it("FR-61.2 (v0.52 fix): a same-day custom range - start and end both 'today' - still includes an order placed today", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("same-day-range@example.com", "same-day-range-store");
    const widget = await createSelfProduct(token, storeId, "Widget", 150);
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "buyer1@example.com");

    // A bare "today" date used to parse as UTC midnight; a real order
    // placed any time later that same day was silently excluded by the
    // `lte` filter, so "To: today" showed none of today's sales.
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app.getHttpServer())
      .get(`/stores/${storeId}/analytics/sales-over-time?bucket=day&start=${today}&end=${today}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].orderCount).toBe(1);
    expect(res.body[0].revenue).toBe(150);
  });

  it("FR-61.5: average order value is the mean totalAmount over confirmed+ orders", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("aov@example.com", "aov-store");
    const widget = await createSelfProduct(token, storeId, "Widget", 100);
    const gadget = await createSelfProduct(token, storeId, "Gadget", 300);
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "buyer1@example.com");
    await placeOrder(token, storeId, hostname, gadget.productId, gadget.variantId, 1, "buyer2@example.com");

    const res = await request(app.getHttpServer()).get(`/stores/${storeId}/analytics/overview`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.aov).toBe(200); // (100 + 300) / 2
  });

  it("FR-61.3: repeat-customer rate counts a buyer with 2+ orders correctly", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("repeat-rate@example.com", "repeat-rate-store");
    const widget = await createSelfProduct(token, storeId, "Widget", 50);
    // buyer1 orders twice (repeat), buyer2 orders once.
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "repeat-buyer@example.com");
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "repeat-buyer@example.com");
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "one-time-buyer@example.com");

    const res = await request(app.getHttpServer()).get(`/stores/${storeId}/analytics/overview`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    // 1 repeat customer out of 2 distinct customers = 50%.
    expect(res.body.repeatCustomerRate).toBe(50);
  });

  it("a store with zero orders reports 0% rates and 0 AOV, not a divide-by-zero error", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("zero-orders@example.com", "zero-orders-store");

    const overview = await request(app.getHttpServer()).get(`/stores/${storeId}/analytics/overview`).set("Authorization", `Bearer ${token}`);
    expect(overview.status).toBe(200);
    expect(overview.body).toEqual({ repeatCustomerRate: 0, returnRate: 0, aov: 0, bestDayOfWeek: null, bestHourOfDay: null });

    const topProducts = await request(app.getHttpServer()).get(`/stores/${storeId}/analytics/top-products`).set("Authorization", `Bearer ${token}`);
    expect(topProducts.body).toEqual([]);
  });

  it("FR-61.7 (Financial Truth Invariant): a pending, never-paid order is excluded from every analytics figure", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("pending-excluded@example.com", "pending-excluded-store");
    const widget = await createSelfProduct(token, storeId, "Widget", 100);
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "paid-buyer@example.com");
    // Never marked as paid - stays 'pending'.
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 5, "pending-buyer@example.com", false);

    const topProducts = await request(app.getHttpServer())
      .get(`/stores/${storeId}/analytics/top-products`)
      .set("Authorization", `Bearer ${token}`);
    // If the pending order's 5 units counted, Widget would show 6 units - it must show exactly 1.
    expect(topProducts.body[0].units).toBe(1);
    expect(topProducts.body[0].revenue).toBe(100);

    const overview = await request(app.getHttpServer()).get(`/stores/${storeId}/analytics/overview`).set("Authorization", `Bearer ${token}`);
    expect(overview.body.aov).toBe(100); // not (100+500)/2

    const salesOverTime = await request(app.getHttpServer())
      .get(`/stores/${storeId}/analytics/sales-over-time?bucket=day`)
      .set("Authorization", `Bearer ${token}`);
    const todayBucket = salesOverTime.body[salesOverTime.body.length - 1];
    expect(todayBucket.orderCount).toBe(1);
    expect(todayBucket.revenue).toBe(100);
  });

  it("FR-61.4: return rate (overall and per-product) counts a completed return correctly, including in its own denominator", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("return-rate@example.com", "return-rate-store");
    const widget = await createSelfProduct(token, storeId, "Widget", 200);
    const order1 = await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "returner@example.com");
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, 1, "keeper@example.com");

    const submit = await request(app.getHttpServer())
      .post(`/storefront/order-status/${order1.token}/returns`)
      .send({ reason: "Changed my mind" });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/returns/${submit.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "approved" });
    const complete = await request(app.getHttpServer())
      .post(`/stores/${storeId}/returns/${submit.body.id}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({ refundAmount: order1.totalAmount });
    expect(complete.status).toBe(201);

    const overview = await request(app.getHttpServer()).get(`/stores/${storeId}/analytics/overview`).set("Authorization", `Bearer ${token}`);
    expect(overview.status).toBe(200);
    // 1 returned order out of 2 total (the refunded order still counts in
    // its own denominator - a return can't shrink the base it's measured
    // against, see analytics.service.ts's RETURN_ELIGIBLE_STATUSES).
    expect(overview.body.returnRate).toBe(50);
    // The refunded order dropped out of AOV/confirmed-set entirely (same
    // exclusion PnLService already applies) - only the kept order remains.
    expect(overview.body.aov).toBe(200);

    const byProduct = await request(app.getHttpServer())
      .get(`/stores/${storeId}/analytics/return-rate-by-product`)
      .set("Authorization", `Bearer ${token}`);
    expect(byProduct.status).toBe(200);
    expect(byProduct.body[0].productTitle).toBe("Widget");
    expect(byProduct.body[0].returnRate).toBe(50);
  });

  it("RLS: a seller cannot see another store's analytics", async () => {
    const a = await signupLoginAndCreateStore("analytics-tenant-a@example.com", "analytics-tenant-a-store");
    const b = await signupLoginAndCreateStore("analytics-tenant-b@example.com", "analytics-tenant-b-store");
    const widget = await createSelfProduct(a.token, a.storeId, "Widget", 100);
    await placeOrder(a.token, a.storeId, a.hostname, widget.productId, widget.variantId, 1, "buyer@example.com");

    const crossTenant = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/analytics/overview`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossTenant.status).toBe(404);
  });
});
