import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 97 (SRS §5.38/FR-38.7-38.10, founder batch "Honest Delivery
 * Tracking") - the buyer-facing 4-state mapping, seller-editable messages,
 * delivered-order display archival, and the seller Orders list badge.
 */
describe("Honest Delivery Tracking (e2e) - SRS §5.38/FR-38.7-38.10", () => {
  let app: INestApplication;
  let superuser: PrismaClient;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId as string, hostname: `${slug}.uzeyn.com` };
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

  async function placeOrder(hostname: string, token: string, storeId: string, price: number) {
    const { productId, variantId } = await createSelfProduct(token, storeId, price);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    return { orderId: checkout.body.id as string, token: checkout.body.statusLookupToken as string };
  }

  async function getItemId(orderId: string) {
    const item = await superuser.orderItem.findFirstOrThrow({ where: { orderId } });
    return item.id;
  }

  describe("Buyer-facing 4-state mapping (FR-38.7)", () => {
    it("pending order maps to 'pending'", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("dt-pending@example.com", "dt-pending-store");
      const { token: lookupToken } = await placeOrder(hostname, token, storeId, 1000);
      const res = await request(app.getHttpServer()).get(`/storefront/order-status/${lookupToken}`);
      expect(res.status).toBe(200);
      expect(res.body.trackingState).toBe("pending");
      expect(res.body.archived).toBe(false);
    });

    it("shipped order (with tracking uploaded) maps to 'submitted_to_courier' and surfaces courier + tracking link", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("dt-shipped@example.com", "dt-shipped-store");
      const { orderId, token: lookupToken } = await placeOrder(hostname, token, storeId, 1000);
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
      const itemId = await getItemId(orderId);
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK123", carrier: "TCS", trackingUrl: "https://tcsexpress.com/track/TRK123" });

      const res = await request(app.getHttpServer()).get(`/storefront/order-status/${lookupToken}`);
      expect(res.status).toBe(200);
      expect(res.body.trackingState).toBe("submitted_to_courier");
      const update = res.body.items[0].trackingUpdates[0];
      expect(update.trackingId).toBe("TRK123");
      expect(update.carrier).toBe("TCS");
      expect(update.trackingUrl).toBe("https://tcsexpress.com/track/TRK123");
    });

    it("delivered order maps to 'delivered'", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("dt-delivered@example.com", "dt-delivered-store");
      const { orderId, token: lookupToken } = await placeOrder(hostname, token, storeId, 1000);
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
      const itemId = await getItemId(orderId);
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK123" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/deliver`)
        .set("Authorization", `Bearer ${token}`);

      const res = await request(app.getHttpServer()).get(`/storefront/order-status/${lookupToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("delivered");
      expect(res.body.trackingState).toBe("delivered");
    });

    it("cancelled order maps to 'cancelled'", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("dt-cancelled@example.com", "dt-cancelled-store");
      const { orderId, token: lookupToken } = await placeOrder(hostname, token, storeId, 1000);
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "cancelled" });

      const res = await request(app.getHttpServer()).get(`/storefront/order-status/${lookupToken}`);
      expect(res.status).toBe(200);
      expect(res.body.trackingState).toBe("cancelled");
    });
  });

  describe("Seller-editable buyer messages (FR-38.8)", () => {
    it("returns defaults, then reflects a seller's saved edit on the buyer's page", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("dt-msg@example.com", "dt-msg-store");

      const defaults = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders/settings/delivery-tracking`)
        .set("Authorization", `Bearer ${token}`);
      expect(defaults.status).toBe(200);
      expect(defaults.body.messagePending).toContain("packed");
      expect(defaults.body.archiveDays).toBe(7);

      const updated = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/orders/settings/delivery-tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ messagePending: "Sit tight, we're packing your order!" });
      expect(updated.status).toBe(200);
      expect(updated.body.messagePending).toBe("Sit tight, we're packing your order!");

      const { token: lookupToken } = await placeOrder(hostname, token, storeId, 1000);
      const res = await request(app.getHttpServer()).get(`/storefront/order-status/${lookupToken}`);
      expect(res.body.trackingMessage).toBe("Sit tight, we're packing your order!");
    });
  });

  describe("Delivered-order display archival (FR-38.9) - archive, never delete", () => {
    it("collapses the buyer page once past the archive window, but leaves the underlying order fully intact", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("dt-archive@example.com", "dt-archive-store");
      const { orderId, token: lookupToken } = await placeOrder(hostname, token, storeId, 1000);
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
      const itemId = await getItemId(orderId);
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK123" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/deliver`)
        .set("Authorization", `Bearer ${token}`);

      // Not archived yet - delivered just now, default 7-day window.
      const fresh = await request(app.getHttpServer()).get(`/storefront/order-status/${lookupToken}`);
      expect(fresh.body.archived).toBe(false);

      // Backdate the "delivered" status_changed event past the window -
      // directly manipulating history the same way the underlying
      // OrderTimelineEvent row is the ONLY source computeOrderTimeline()
      // reads, no separate "archived" flag exists anywhere.
      const eightDaysAgo = new Date(Date.now() - 8 * 86400_000);
      await superuser.orderTimelineEvent.updateMany({
        where: { orderId, eventType: "status_changed", afterValue: { path: ["status"], equals: "delivered" } },
        data: { createdAt: eightDaysAgo },
      });

      const archived = await request(app.getHttpServer()).get(`/storefront/order-status/${lookupToken}`);
      expect(archived.status).toBe(200);
      expect(archived.body.archived).toBe(true);
      expect(archived.body.trackingState).toBe("delivered");
      expect(archived.body.deliveredAt).toBeTruthy();
      expect(archived.body.items).toBeUndefined();
      expect(archived.body.timeline).toBeUndefined();

      // The underlying order is untouched - full detail still exists for
      // the seller's own view (items, tracking, everything).
      const sellerView = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders/${orderId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(sellerView.status).toBe(200);
      expect(sellerView.body.status).toBe("delivered");
      expect(sellerView.body.items).toHaveLength(1);
      expect(sellerView.body.items[0].trackingUpdates).toHaveLength(1);
    });

    it("a shorter, seller-configured archive window is respected", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("dt-archive-short@example.com", "dt-archive-short-store");
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/orders/settings/delivery-tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ archiveDays: 1 });

      const { orderId, token: lookupToken } = await placeOrder(hostname, token, storeId, 1000);
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
      const itemId = await getItemId(orderId);
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK123" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/deliver`)
        .set("Authorization", `Bearer ${token}`);

      const twoDaysAgo = new Date(Date.now() - 2 * 86400_000);
      await superuser.orderTimelineEvent.updateMany({
        where: { orderId, eventType: "status_changed", afterValue: { path: ["status"], equals: "delivered" } },
        data: { createdAt: twoDaysAgo },
      });

      const res = await request(app.getHttpServer()).get(`/storefront/order-status/${lookupToken}`);
      expect(res.body.archived).toBe(true);
    });
  });

  describe("Seller Orders list badge (FR-38.10)", () => {
    it("exposes the same trackingState bucket on each order in the list", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("dt-list@example.com", "dt-list-store");
      await placeOrder(hostname, token, storeId, 1000);

      const res = await request(app.getHttpServer()).get(`/stores/${storeId}/orders`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].trackingState).toBe("pending");
    });
  });
});
