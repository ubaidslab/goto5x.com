import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { ProductImportService } from "../../src/data-portability/product-import.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const PASSWORD = "correct-horse-battery";
const S3_TEST_PORT = 4569;
const BUCKET = "uzeyn-media-test";

const shippingAddress = { fullName: "Buyer", line1: "House 1", city: "Lahore", country: "PK", phone: "03001234567" };

/**
 * Module 52 (SRS §5.59/FR-59.1-59.5) - Order.orderNumber, the first order-
 * status transition map, the order-level tracking-entry path (shared by
 * inline quick-entry and CSV import), and advanced search/filters +
 * pagination. Bulk mark-as-paid/fulfill reuse the pre-existing
 * mark-as-paid/deliver endpoints unchanged (already covered by
 * orders.e2e-spec.ts/module27-orders-command-center.e2e-spec.ts) - this
 * file focuses on what's genuinely new: orderNumber, changeStatus(), the
 * order-level tracking write, and the filter/pagination surface.
 */
describe("Bulk Order Operations, Tracking Entry & Advanced Search (e2e) - SRS §5.59/§14.59 (Module 52)", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let s3: TestS3Server;

  beforeAll(async () => {
    s3 = await startTestS3Server(S3_TEST_PORT, BUCKET);
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
    await s3.close();
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

  /** Places one order (via storefront checkout) and returns its id/orderNumber/itemId. */
  async function placeOrder(token: string, storeId: string, hostname: string, buyerEmail = "buyer@example.com") {
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail, items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const detail = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders/${checkout.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    return { orderId: checkout.body.id as string, orderNumber: detail.body.orderNumber as number, itemId: detail.body.items[0].id as string };
  }

  describe("Order.orderNumber (FR-59.1)", () => {
    it("assigns sequential, per-store numbers starting at 1, and two different stores each start their own sequence at 1", async () => {
      const a = await signupLoginAndCreateStore("orderno-a@example.com", "orderno-a-store");
      const b = await signupLoginAndCreateStore("orderno-b@example.com", "orderno-b-store");

      const a1 = await placeOrder(a.token, a.storeId, a.hostname);
      const a2 = await placeOrder(a.token, a.storeId, a.hostname);
      const b1 = await placeOrder(b.token, b.storeId, b.hostname);

      expect(a1.orderNumber).toBe(1);
      expect(a2.orderNumber).toBe(2);
      expect(b1.orderNumber).toBe(1);
    });
  });

  describe("First formal order-status transition map (FR-59.2/FR-59.5)", () => {
    it("allows confirmed -> cancelled and delivered -> completed", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("transition-ok@example.com", "transition-ok-store");
      const { orderId, itemId } = await placeOrder(token, storeId, hostname);

      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
      const cancel = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "cancelled" });
      expect(cancel.status).toBe(200);
      expect(cancel.body.status).toBe("cancelled");

      const { orderId: orderId2, itemId: itemId2 } = await placeOrder(token, storeId, hostname);
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId2}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId2}/items/${itemId2}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK-1" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId2}/items/${itemId2}/deliver`)
        .set("Authorization", `Bearer ${token}`);
      const complete = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/orders/${orderId2}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "completed" });
      expect(complete.status).toBe(200);
      expect(complete.body.status).toBe("completed");
      void itemId;
    });

    it("rejects a transition not in the map (pending -> disputed) with 400, and the order is left unchanged", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("transition-bad@example.com", "transition-bad-store");
      const { orderId } = await placeOrder(token, storeId, hostname);

      const disputed = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "disputed" });
      expect(disputed.status).toBe(400);

      const unchanged = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(unchanged.status).toBe("pending");
    });

    it("rejects DTO values outside {cancelled,disputed,completed} - confirmed/shipped only reachable via markAsPaid()/tracking", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("transition-dto@example.com", "transition-dto-store");
      const { orderId } = await placeOrder(token, storeId, hostname);

      const bad = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "confirmed" });
      expect(bad.status).toBe(400);
    });
  });

  describe("Order-level tracking-entry path, shared by quick-entry and CSV import (FR-59.3)", () => {
    it("(b) quick-entry: applies one courier/tracking pair to every not-yet-shipped item and bumps the order to shipped", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("quickentry@example.com", "quickentry-store");
      const { orderId } = await placeOrder(token, storeId, hostname);
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);

      const upload = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK-QE-1", carrier: "TCS" });
      expect(upload.status).toBe(201);
      expect(upload.body.status).toBe("shipped");

      const item = await superuser.orderItem.findFirstOrThrow({ where: { orderId } });
      expect(item.fulfillmentStatus).toBe("shipped");
      const tracking = await superuser.trackingUpdate.findFirstOrThrow({ where: { orderItemId: item.id } });
      expect(tracking.trackingId).toBe("TRK-QE-1");
      expect(tracking.carrier).toBe("TCS");
    });

    it("(b) rejects a second quick-entry call once every item already has tracking", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("quickentry-twice@example.com", "quickentry-twice-store");
      const { orderId } = await placeOrder(token, storeId, hostname);
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK-1" });

      const again = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK-2" });
      expect(again.status).toBe(400);
    });

    it("(a) CSV import resolves OrderNumber -> order and applies tracking via the same write path as quick-entry", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("csv-tracking@example.com", "csv-tracking-store");
      const { orderId, orderNumber } = await placeOrder(token, storeId, hostname);
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);

      const csv = `OrderNumber,Courier,TrackingId\n${orderNumber},Leopards,TRK-CSV-1\n9999,Leopards,TRK-CSV-BAD\n`;
      const upload = await request(app.getHttpServer())
        .post(`/stores/${storeId}/tracking-import-jobs`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from(csv), "tracking.csv");
      expect(upload.status).toBe(201);

      const uploader = await superuser.user.findUniqueOrThrow({ where: { email: "csv-tracking@example.com" } });
      const productImport = app.get(ProductImportService);
      await productImport.process(upload.body.id, uploader.id);

      const job = await superuser.importJob.findUniqueOrThrow({ where: { id: upload.body.id } });
      expect(job.status).toBe("completed");
      expect((job.errorLog as { message: string }[]).some((e) => e.message.includes("9999"))).toBe(true);

      const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.status).toBe("shipped");
      const item = await superuser.orderItem.findFirstOrThrow({ where: { orderId } });
      const tracking = await superuser.trackingUpdate.findFirstOrThrow({ where: { orderItemId: item.id } });
      expect(tracking.trackingId).toBe("TRK-CSV-1");
    });
  });

  describe("Advanced order search/filters + pagination (FR-59.4)", () => {
    it("date range, amount range, and customer filters each narrow the result set correctly, combinable", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("filters@example.com", "filters-store");
      const cheap = await placeOrder(token, storeId, hostname, "alice@example.com");
      const pricey = await placeOrder(token, storeId, hostname, "bob@example.com");
      await superuser.order.update({ where: { id: pricey.orderId }, data: { totalAmount: 5000, placedAt: new Date("2020-01-01T00:00:00Z") } });

      const byAmount = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders`)
        .query({ minAmount: "1000" })
        .set("Authorization", `Bearer ${token}`);
      expect(byAmount.body.items.map((o: any) => o.id)).toEqual([pricey.orderId]);

      const byCustomer = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders`)
        .query({ customer: "alice" })
        .set("Authorization", `Bearer ${token}`);
      expect(byCustomer.body.items.map((o: any) => o.id)).toEqual([cheap.orderId]);

      const byDateRange = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders`)
        .query({ dateFrom: "2019-01-01T00:00:00Z", dateTo: "2021-01-01T00:00:00Z" })
        .set("Authorization", `Bearer ${token}`);
      expect(byDateRange.body.items.map((o: any) => o.id)).toEqual([pricey.orderId]);

      const combined = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders`)
        .query({ minAmount: "1000", customer: "bob" })
        .set("Authorization", `Bearer ${token}`);
      expect(combined.body.total).toBe(1);
      expect(combined.body.items[0].id).toBe(pricey.orderId);
    });

    it("paginates with no cross-page overlap and an accurate total/totalPages", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("orders-paging@example.com", "orders-paging-store");
      for (let i = 0; i < 5; i++) {
        await placeOrder(token, storeId, hostname, `buyer${i}@example.com`);
      }

      const page1 = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders`)
        .query({ page: "1", limit: "2" })
        .set("Authorization", `Bearer ${token}`);
      const page2 = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders`)
        .query({ page: "2", limit: "2" })
        .set("Authorization", `Bearer ${token}`);

      expect(page1.body.total).toBe(5);
      expect(page1.body.totalPages).toBe(3);
      expect(page1.body.items).toHaveLength(2);
      expect(page2.body.items).toHaveLength(2);
      const page1Ids = page1.body.items.map((o: any) => o.id);
      const page2Ids = page2.body.items.map((o: any) => o.id);
      expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
    });
  });
});
