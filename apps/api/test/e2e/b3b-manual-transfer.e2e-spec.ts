import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { ManualTransferAutoCancelService } from "../../src/orders/manual-transfer-auto-cancel.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * B3b (founder decision, 2026-10-11) - the "advance" payment model's
 * Manual Transfer fallback for sellers with no live gateway: a seller's
 * own configured bank/JazzCash/Easypaisa details stand in for a gateway
 * connection at checkout, a buyer submits a self-reported reference, and
 * the seller confirms via the pre-existing markAsPaid()/changeStatus(
 * "cancelled") actions - no new OrderStatus. Builds directly on Founder
 * item 3's restoreStockForOrder()/concurrency-safe changeStatus(), proved
 * separately in module52-bulk-order-ops.e2e-spec.ts.
 */
describe("B3b: Manual Transfer for the Advance payment model (founder decision, 2026-10-11)", () => {
  let app: INestApplication;
  let superuser: PrismaClient;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
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
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId as string, userId: user.id, hostname: `${slug}.uzeyn.com` };
  }

  async function setAdvanceModelWithManualTransfer(token: string, storeId: string) {
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/payment-model`)
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentModel: "advance", advancePercent: 20 });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/payment-instructions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bankAccountTitle: "Store Owner", bankAccountNumber: "PK00BANK0000000000000000", nameDeclaredSelfOwned: true });
  }

  async function createSelfProduct(token: string, storeId: string, price: number, stockQuantity = 10) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function placeAdvanceOrder(hostname: string, token: string, storeId: string, price: number, stockQuantity = 10) {
    const { productId, variantId } = await createSelfProduct(token, storeId, price, stockQuantity);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    return { ...(checkout.body as { id: string; statusLookupToken: string }), variantId, checkoutStatus: checkout.status };
  }

  describe("Checkout gate relaxation (requirement #8)", () => {
    it("allows placing an advance-model order once the seller has configured a bank account title + number, with no gateway at all", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("b3b-gate-ok@example.com", "b3b-gate-ok-store");
      await setAdvanceModelWithManualTransfer(token, storeId);
      const order = await placeAdvanceOrder(hostname, token, storeId, 1000);
      expect(order.checkoutStatus).toBe(201);
    });

    it("still blocks advance when only a bare number is configured, no account title (title+number pair required)", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("b3b-gate-notitle@example.com", "b3b-gate-notitle-store");
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-model`)
        .set("Authorization", `Bearer ${token}`)
        .send({ paymentModel: "advance", advancePercent: 20 });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ bankAccountNumber: "PK00BANK0000000000000000" });
      const order = await placeAdvanceOrder(hostname, token, storeId, 1000);
      expect(order.checkoutStatus).toBe(400);
    });
  });

  describe("Happy path: buyer submits a reference, seller confirms via the existing markAsPaid()", () => {
    it("the order starts pending, the buyer's submitted reference is stored, and markAsPaid() confirms it with an audit trail of who confirmed", async () => {
      const { token, storeId, hostname, userId } = await signupLoginAndCreateStore("b3b-happy@example.com", "b3b-happy-store");
      await setAdvanceModelWithManualTransfer(token, storeId);
      const order = await placeAdvanceOrder(hostname, token, storeId, 1000);
      expect(order.checkoutStatus).toBe(201);

      const pending = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(pending.status).toBe("pending");
      expect(pending.manualTransferReference).toBeNull();

      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.statusLookupToken}/manual-transfer`)
        .send({ reference: "TXN-REF-12345", senderName: "Ayesha Khan" });
      expect(submit.status).toBe(201);
      expect(submit.body.manualTransferReference).toBe("TXN-REF-12345");

      const afterSubmit = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(afterSubmit.manualTransferReference).toBe("TXN-REF-12345");
      expect(afterSubmit.manualTransferSenderName).toBe("Ayesha Khan");
      expect(afterSubmit.manualTransferSubmittedAt).not.toBeNull();
      expect(afterSubmit.status).toBe("pending"); // submitting a reference never confirms the order by itself

      const markPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${order.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(markPaid.status).toBe(201);
      expect(markPaid.body.status).toBe("confirmed");

      const placedEvent = await superuser.platformEvent.findFirstOrThrow({ where: { eventType: "order.placed", entityId: order.id } });
      expect((placedEvent.metadata as { confirmedByUserId?: string }).confirmedByUserId).toBe(userId);
    });
  });

  describe("Seller rejects (\"Not received\") - reuses the existing cancel + stock-restore path", () => {
    it("cancelling an unconfirmed advance order restores its stock, same as any other cancellation", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("b3b-reject@example.com", "b3b-reject-store");
      await setAdvanceModelWithManualTransfer(token, storeId);
      const order = await placeAdvanceOrder(hostname, token, storeId, 1000, 10);

      const afterCheckout = await superuser.productVariant.findUniqueOrThrow({ where: { id: order.variantId } });
      expect(afterCheckout.stockQuantity).toBe(9);

      const reject = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/orders/${order.id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "cancelled" });
      expect(reject.status).toBe(200);

      const afterReject = await superuser.productVariant.findUniqueOrThrow({ where: { id: order.variantId } });
      expect(afterReject.stockQuantity).toBe(10);
    });
  });

  describe("Shipping is blocked before confirmation (requirement #1)", () => {
    it("uploading tracking on a still-pending advance order is rejected, not shipped", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("b3b-ship-blocked@example.com", "b3b-ship-blocked-store");
      await setAdvanceModelWithManualTransfer(token, storeId);
      const order = await placeAdvanceOrder(hostname, token, storeId, 1000);

      const tracking = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${order.id}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK-1" });
      expect(tracking.status).toBe(400);

      const unchanged = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(unchanged.status).toBe("pending");
    });

    it("shipping works again once the seller confirms via markAsPaid()", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("b3b-ship-allowed@example.com", "b3b-ship-allowed-store");
      await setAdvanceModelWithManualTransfer(token, storeId);
      const order = await placeAdvanceOrder(hostname, token, storeId, 1000);
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${order.id}/mark-as-paid`).set("Authorization", `Bearer ${token}`);

      const tracking = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${order.id}/tracking`)
        .set("Authorization", `Bearer ${token}`)
        .send({ trackingId: "TRK-1" });
      expect(tracking.status).toBe(201);
    });
  });

  describe("Injection attempt in the reference field (requirement #2's validation)", () => {
    it("rejects a reference/sender name containing HTML-special characters", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("b3b-injection@example.com", "b3b-injection-store");
      await setAdvanceModelWithManualTransfer(token, storeId);
      const order = await placeAdvanceOrder(hostname, token, storeId, 1000);

      const xssReference = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.statusLookupToken}/manual-transfer`)
        .send({ reference: "<script>alert(1)</script>", senderName: "Ayesha" });
      expect(xssReference.status).toBe(400);

      const xssSender = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.statusLookupToken}/manual-transfer`)
        .send({ reference: "TXN-1", senderName: "\"><img src=x onerror=alert(1)>" });
      expect(xssSender.status).toBe(400);

      const unchanged = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(unchanged.manualTransferReference).toBeNull();
    });

    it("rejects submitting against a wrong/unknown token, and against an order not using the advance model", async () => {
      const bogus = await request(app.getHttpServer())
        .post("/storefront/order-status/not-a-real-token/manual-transfer")
        .send({ reference: "TXN-1", senderName: "Ayesha" });
      expect(bogus.status).toBe(404);

      const { token, storeId, hostname } = await signupLoginAndCreateStore("b3b-wrong-model@example.com", "b3b-wrong-model-store");
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ codEnabled: true });
      const { productId, variantId } = await createSelfProduct(token, storeId, 500);
      const cart = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
      const checkout = await request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress }); // default model is "cod"

      const wrongModel = await request(app.getHttpServer())
        .post(`/storefront/order-status/${checkout.body.statusLookupToken}/manual-transfer`)
        .send({ reference: "TXN-1", senderName: "Ayesha" });
      expect(wrongModel.status).toBe(400);
    });
  });

  describe("Auto-cancel sweep (requirement #4) - the same shared stock-restore function as item 3 and the seller-rejects path above", () => {
    it("cancels a stale unpaid advance order past its store's timeout window and restores stock", async () => {
      const { token, storeId, hostname, sellerId } = await signupLoginAndCreateStore("b3b-autocancel@example.com", "b3b-autocancel-store");
      await setAdvanceModelWithManualTransfer(token, storeId);
      const order = await placeAdvanceOrder(hostname, token, storeId, 1000, 10);

      const settings = app.get(SettingsService);
      await settings.setValue("orders.advance_manual_transfer_timeout_hours", "store", storeId, 1, sellerId);
      await superuser.order.update({ where: { id: order.id }, data: { placedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });

      const sweep = app.get(ManualTransferAutoCancelService);
      const result = await sweep.runSweep();
      expect(result.cancelled).toBe(1);

      const afterSweep = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(afterSweep.status).toBe("cancelled");
      const variant = await superuser.productVariant.findUniqueOrThrow({ where: { id: order.variantId } });
      expect(variant.stockQuantity).toBe(10); // restored
    });

    it("leaves a fresh (not-yet-overdue) pending advance order alone", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("b3b-autocancel-fresh@example.com", "b3b-autocancel-fresh-store");
      await setAdvanceModelWithManualTransfer(token, storeId);
      const order = await placeAdvanceOrder(hostname, token, storeId, 1000);

      const sweep = app.get(ManualTransferAutoCancelService);
      const result = await sweep.runSweep();
      expect(result.cancelled).toBe(0);

      const unchanged = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(unchanged.status).toBe("pending");
    });
  });
});
