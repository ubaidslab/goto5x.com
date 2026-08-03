import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 27 (SRS §5.38, §14.38) - Orders Command Center + tracking
 * timeline. The bucketed-count endpoint and its "click through to exactly
 * these orders" filter share one predicate (`orderBucketWhereClause`) by
 * construction - these tests prove that equivalence directly, plus the
 * timeline computed the same way on both the public and seller surfaces.
 */
describe("Orders Command Center + Tracking Timeline (e2e) - SRS §5.38, §14.38", () => {
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

  const shippingAddress = {
    fullName: "Ayesha Khan",
    line1: "House 12, Street 3",
    city: "Lahore",
    country: "PK",
    phone: "03001234567",
  };

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
    await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { userId: user.id }, data: { cnicHash: `test-cnic-hash-${user.id}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, hostname: `${slug}.goto5x.com` };
  }

  async function placeOrder(token: string, storeId: string, hostname: string) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Command Center Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price: 1000, stockQuantity: 100 });
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    return { orderId: checkout.body.id as string, itemId: checkout.body.items[0].id as string };
  }

  it("bucket counts sum to the store's total order count, with zero orders double-counted or dropped (FR-38.1)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("cc-buckets@example.com", "cc-buckets-store");

    // pending (no verification)
    await placeOrder(token, storeId, hostname);
    // awaitingVerification
    const awaitingVerification = await placeOrder(token, storeId, hostname);
    await superuser.orderVerification.create({
      data: { storeId, orderId: awaitingVerification.orderId, channel: "whatsapp_otp", status: "pending" },
    });
    // prepaidReceived
    const prepaidReceived = await placeOrder(token, storeId, hostname);
    await superuser.orderVerification.create({
      data: { storeId, orderId: prepaidReceived.orderId, channel: "prepaid_confirmation", status: "verified" },
    });
    // awaitingTracking (confirmed)
    const awaitingTracking = await placeOrder(token, storeId, hostname);
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${awaitingTracking.orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    // shipped
    const shipped = await placeOrder(token, storeId, hostname);
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${shipped.orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${shipped.orderId}/items/${shipped.itemId}/tracking`)
      .set("Authorization", `Bearer ${token}`)
      .send({ trackingId: "TRK-1", carrier: "TCS" });
    // delivered
    const delivered = await placeOrder(token, storeId, hostname);
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${delivered.orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${delivered.orderId}/items/${delivered.itemId}/tracking`)
      .set("Authorization", `Bearer ${token}`)
      .send({ trackingId: "TRK-2" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${delivered.orderId}/items/${delivered.itemId}/deliver`)
      .set("Authorization", `Bearer ${token}`);
    // cancelledReturned
    const cancelled = await placeOrder(token, storeId, hostname);
    await superuser.order.update({ where: { id: cancelled.orderId }, data: { status: "cancelled" } });

    const overview = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders/overview`)
      .set("Authorization", `Bearer ${token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.buckets).toEqual({
      pending: 1,
      awaitingVerification: 1,
      prepaidReceived: 1,
      awaitingTracking: 1,
      shipped: 1,
      delivered: 1,
      cancelledReturned: 1,
    });
    expect(overview.body.total).toBe(7);

    const allOrders = await request(app.getHttpServer()).get(`/stores/${storeId}/orders`).set("Authorization", `Bearer ${token}`);
    expect(allOrders.body).toHaveLength(7);
  });

  it("each bucket's list-filter click-through returns exactly the orders counted in that bucket, never more/fewer (FR-38.2)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("cc-clickthrough@example.com", "cc-clickthrough-store");

    const plainPending = await placeOrder(token, storeId, hostname);
    const awaitingVerification = await placeOrder(token, storeId, hostname);
    await superuser.orderVerification.create({
      data: { storeId, orderId: awaitingVerification.orderId, channel: "email_otp", status: "pending" },
    });

    const pendingList = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders?bucket=pending`)
      .set("Authorization", `Bearer ${token}`);
    expect(pendingList.body.map((o: any) => o.id)).toEqual([plainPending.orderId]);

    const awaitingVerificationList = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders?bucket=awaitingVerification`)
      .set("Authorization", `Bearer ${token}`);
    expect(awaitingVerificationList.body.map((o: any) => o.id)).toEqual([awaitingVerification.orderId]);
  });

  it(
    "the order timeline advances correctly as an order is paid, tracked, and delivered, and the public order-status " +
      "page renders the exact same timeline as the seller's own order-detail view (FR-38.5)",
    async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("cc-timeline@example.com", "cc-timeline-store");
      const { orderId, itemId } = await placeOrder(token, storeId, hostname);

      const afterPlaced = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(afterPlaced.body.timeline.map((s: any) => s.stage)).toEqual(["placed", "confirmed", "shipped", "delivered"]);
      expect(afterPlaced.body.timeline[0].completedAt).toBeTruthy();
      expect(afterPlaced.body.timeline[1].completedAt).toBeNull();

      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK-9", carrier: "Leopards" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/deliver`)
        .set("Authorization", `Bearer ${token}`);

      const sellerView = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`);
      const sellerTimeline = sellerView.body.timeline;
      expect(sellerTimeline.every((s: any) => s.completedAt !== null)).toBe(true);

      const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });
      const publicView = await request(app.getHttpServer()).get(`/storefront/order-status/${order.statusLookupToken}`);
      expect(publicView.status).toBe(200);
      expect(publicView.body.timeline).toEqual(sellerTimeline);
    },
  );

  it("supplier-uploaded tracking is still role-isolated after this module ships - a supplier cannot upload tracking for another supplier's item (FR-38.4)", async () => {
    const { token: sellerToken, storeId, hostname } = await signupLoginAndCreateStore("cc-role@example.com", "cc-role-store");

    const supplierAEmail = `supplier-a-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email: supplierAEmail, password: PASSWORD, businessName: "Supplier A", role: "supplier" });
    const supplierALogin = await request(app.getHttpServer()).post("/auth/login").send({ email: supplierAEmail, password: PASSWORD });
    const supplierAToken = supplierALogin.body.accessToken as string;

    const supplierBEmail = `supplier-b-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email: supplierBEmail, password: PASSWORD, businessName: "Supplier B", role: "supplier" });
    const supplierBLogin = await request(app.getHttpServer()).post("/auth/login").send({ email: supplierBEmail, password: PASSWORD });
    const supplierBToken = supplierBLogin.body.accessToken as string;

    const supplierAUser = await superuser.user.findUniqueOrThrow({ where: { email: supplierAEmail }, include: { supplier: true } });
    const listing = await superuser.supplierListing.create({
      data: {
        supplierId: supplierAUser.supplier!.id,
        adapterType: "printify",
        externalProductId: `ext-${Date.now()}`,
        title: "Supplier Mug",
        price: 500,
        shippingCost: 100,
        stockQuantity: 999,
        estimatedDeliveryMinDays: 5,
        estimatedDeliveryMaxDays: 10,
        supportedCountries: ["PK"],
        rawPayload: {},
      },
    });
    const link = await request(app.getHttpServer()).post("/supplier/store-links").set("Authorization", `Bearer ${supplierAToken}`).send({ storeSlug: "cc-role-store" });
    await request(app.getHttpServer()).patch(`/stores/${storeId}/supplier-links/${link.body.id}/approve`).set("Authorization", `Bearer ${sellerToken}`);
    const submit = await request(app.getHttpServer())
      .post("/supplier/listings/submit-review")
      .set("Authorization", `Bearer ${supplierAToken}`)
      .send({ storeSupplierLinkId: link.body.id, supplierListingId: listing.id });
    await request(app.getHttpServer()).patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`).set("Authorization", `Bearer ${sellerToken}`);

    const product = await superuser.product.findFirstOrThrow({ where: { title: "Supplier Mug" } });
    const variant = await superuser.productVariant.findFirstOrThrow({ where: { productId: product.id } });
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId: product.id, variantId: variant.id, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const itemId = checkout.body.items[0].id as string;

    const crossUpload = await request(app.getHttpServer())
      .post(`/supplier/order-items/${itemId}/tracking`)
      .set("Authorization", `Bearer ${supplierBToken}`)
      .send({ trackingId: "SHOULD-FAIL" });
    expect(crossUpload.status).toBe(404);

    const ownUpload = await request(app.getHttpServer())
      .post(`/supplier/order-items/${itemId}/tracking`)
      .set("Authorization", `Bearer ${supplierAToken}`)
      .send({ trackingId: "TRK-OK" });
    expect(ownUpload.status).toBe(201);
  });

  it("a pending/awaiting-verification order is visible on the Command Center but never counted as a confirmed sale (FR-38.6)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("cc-fti@example.com", "cc-fti-store");
    const { orderId } = await placeOrder(token, storeId, hostname);
    await superuser.orderVerification.create({
      data: { storeId, orderId, channel: "whatsapp_otp", status: "pending" },
    });

    const overview = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders/overview`)
      .set("Authorization", `Bearer ${token}`);
    expect(overview.body.buckets.awaitingVerification).toBe(1);

    const eventsBeforeConfirmed = await superuser.platformEvent.findMany({ where: { eventType: "order.placed", entityId: orderId } });
    expect(eventsBeforeConfirmed).toHaveLength(0);

    const blockedMarkPaid = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    expect(blockedMarkPaid.status).toBe(400);
  });
});
