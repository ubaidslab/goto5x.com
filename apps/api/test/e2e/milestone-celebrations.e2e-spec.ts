import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const shippingAddress = { fullName: "Buyer", line1: "House 1", city: "Lahore", country: "PK", phone: "03001234567" };

/**
 * Module 47 milestone-celebrations slice (SRS §5.47/FR-47.2, FR-47.3;
 * §14.47 acceptance checklist). Only this slice of Module 47 is built -
 * FR-47.1 (celebratory onboarding reframe), FR-47.4 (achievement badges),
 * and FR-47.5 (personalization tie-in) are out of scope here.
 */
describe("Milestone celebrations (e2e) - SRS §5.47/§14.47 (Module 47, FR-47.2/47.3 slice)", () => {
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

  async function placeOrder(
    token: string,
    storeId: string,
    hostname: string,
    productId: string,
    variantId: string,
    buyerEmail: string,
    payNow = true,
  ) {
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail, items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    if (payNow) {
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${checkout.body.id}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
    }
    return checkout.body.id as string;
  }

  it("FR-47.2 (Financial Truth Invariant): a pending, never-paid order never crosses a milestone threshold", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("milestone-pending@example.com", "milestone-pending-store");
    const widget = await createSelfProduct(token, storeId, "Widget", 100);
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, "buyer1@example.com", false);

    const beforeConfirm = await request(app.getHttpServer()).get(`/stores/${storeId}/milestones/recent`).set("Authorization", `Bearer ${token}`);
    expect(beforeConfirm.status).toBe(200);
    // The default order_count thresholds include 1 - if the pending order
    // counted, this would already be non-null.
    expect(beforeConfirm.body.milestone).toBeNull();

    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, "buyer2@example.com", true);

    const afterConfirm = await request(app.getHttpServer()).get(`/stores/${storeId}/milestones/recent`).set("Authorization", `Bearer ${token}`);
    expect(afterConfirm.status).toBe(200);
    expect(afterConfirm.body.milestone).toMatchObject({ metric: "order_count", threshold: 1 });
  });

  it("FR-47.3: a milestone celebrates exactly once per store per threshold, even across multiple subsequent qualifying orders", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("milestone-once@example.com", "milestone-once-store");
    const widget = await createSelfProduct(token, storeId, "Widget", 100);

    // Three confirmed orders all satisfy (and re-attempt) the order_count=1
    // threshold - only the first insert should ever succeed.
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, "buyer1@example.com");
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, "buyer2@example.com");
    await placeOrder(token, storeId, hostname, widget.productId, widget.variantId, "buyer3@example.com");

    const events = await superuser.milestoneEvent.findMany({ where: { storeId, metric: "order_count", threshold: 1 } });
    expect(events).toHaveLength(1);
  });

  it("a store past the sales-amount threshold also gets a sales_amount milestone, independent of the order-count one", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("milestone-revenue@example.com", "milestone-revenue-store");
    // Smallest default sales_amount threshold is 10000 (PKR) - one order at
    // that exact price crosses both the order_count=1 and sales_amount=10000
    // thresholds in the same confirmation.
    const expensive = await createSelfProduct(token, storeId, "Premium Widget", 10000);
    await placeOrder(token, storeId, hostname, expensive.productId, expensive.variantId, "buyer1@example.com");

    const orderCountEvent = await superuser.milestoneEvent.findFirst({ where: { storeId, metric: "order_count", threshold: 1 } });
    const revenueEvent = await superuser.milestoneEvent.findFirst({ where: { storeId, metric: "sales_amount", threshold: 10000 } });
    expect(orderCountEvent).not.toBeNull();
    expect(revenueEvent).not.toBeNull();
  });

  it("RLS: a seller cannot see another store's milestone events", async () => {
    const a = await signupLoginAndCreateStore("milestone-tenant-a@example.com", "milestone-tenant-a-store");
    const b = await signupLoginAndCreateStore("milestone-tenant-b@example.com", "milestone-tenant-b-store");
    const widget = await createSelfProduct(a.token, a.storeId, "Widget", 100);
    await placeOrder(a.token, a.storeId, a.hostname, widget.productId, widget.variantId, "buyer@example.com");

    const crossTenant = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/milestones/recent`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossTenant.status).toBe(404);
  });
});
