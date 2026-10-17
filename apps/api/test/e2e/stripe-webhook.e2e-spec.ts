import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import Stripe from "stripe";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const WEBHOOK_SECRET = "whsec_test_fake_secret_for_e2e";

/**
 * B2 (founder decision, sandbox only) - unlike module62-payment-gateway-
 * connect.e2e-spec.ts's other four providers, this never needs a fake
 * adapter override: the webhook path never calls StripeGatewayAdapter
 * at all (see stripe-webhook.controller.ts's own comment on why), so
 * everything here runs for real, including the actual official Stripe
 * SDK's signature construction/verification (pure local HMAC, no
 * network call) - buildTestApp() straight from setup.ts, same as any
 * other spec that needs no provider override.
 *
 * shippingAddress/signupLoginAndCreateStore/createSelfProduct/placeOrder
 * mirror module62-payment-gateway-connect.e2e-spec.ts's own helpers.
 */
describe("Stripe webhook (e2e) - D117/B2, sandbox only", () => {
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
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function createSelfProduct(token: string, storeId: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Stripe Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function placeOrder(hostname: string, token: string, storeId: string) {
    const { productId, variantId } = await createSelfProduct(token, storeId, 1500);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "stripe-buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);
    return checkout.body as { id: string; statusLookupToken: string };
  }

  async function connectStripe(token: string, storeId: string, webhookSecret = WEBHOOK_SECRET) {
    const connect = await request(app.getHttpServer())
      .post(`/stores/${storeId}/payment-gateway`)
      .set("Authorization", `Bearer ${token}`)
      .send({ provider: "stripe", apiKey: "rk_test_fake_restricted_key", webhookSecret });
    expect(connect.status).toBe(201);
  }

  function signedPayload(event: unknown) {
    const payload = JSON.stringify(event);
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    return { payload, header };
  }

  describe("Connect: restricted keys only", () => {
    it("rejects a Stripe secret key (sk_...) with a clear message", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("stripe-sk@example.com", "stripe-sk-store");
      const connect = await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "stripe", apiKey: "sk_test_should_be_rejected", webhookSecret: WEBHOOK_SECRET });
      expect(connect.status).toBe(400);
      expect(connect.body.message.message).toMatch(/restricted key/);
    });

    it("rejects connecting Stripe with no webhook secret", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("stripe-nowebhook@example.com", "stripe-nowebhook-store");
      const connect = await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "stripe", apiKey: "rk_test_fake" });
      expect(connect.status).toBe(400);
    });

    it("accepts a restricted key + webhook secret, and never returns either in the response or raw in the DB", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("stripe-connect@example.com", "stripe-connect-store");
      const connect = await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "stripe", apiKey: "rk_test_fake_restricted_key", webhookSecret: WEBHOOK_SECRET });
      expect(connect.status).toBe(201);
      expect(JSON.stringify(connect.body)).not.toContain("rk_test_fake_restricted_key");
      expect(JSON.stringify(connect.body)).not.toContain(WEBHOOK_SECRET);

      const row = await superuser.storePaymentGatewayConnection.findFirstOrThrow({ where: { storeId, provider: "stripe" } });
      expect(row.webhookSecretEncrypted).not.toContain(WEBHOOK_SECRET);
      expect(row.apiKeyEncrypted).not.toContain("rk_test_fake_restricted_key");
    });
  });

  describe("Webhook: signature verification + dedupe + confirmation", () => {
    it("404s when no Stripe connection exists for the store", async () => {
      const { storeId } = await signupLoginAndCreateStore("stripe-noconn@example.com", "stripe-noconn-store");
      const { payload, header } = signedPayload({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
      const res = await request(app.getHttpServer())
        .post(`/payment-gateway/webhooks/stripe/${storeId}`)
        .set("Stripe-Signature", header)
        .set("Content-Type", "application/json")
        .send(payload);
      expect(res.status).toBe(404);
    });

    it("rejects a forged signature (wrong secret) with 400, never touches the order", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("stripe-forged@example.com", "stripe-forged-store");
      await connectStripe(token, storeId);
      const order = await placeOrder(hostname, token, storeId);

      const payload = JSON.stringify({
        id: "evt_forged",
        type: "checkout.session.completed",
        data: { object: { payment_status: "paid", client_reference_id: order.id, payment_intent: "pi_forged", amount_total: 150000, currency: "pkr" } },
      });
      const forgedHeader = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_totally_wrong_secret" });

      const res = await request(app.getHttpServer())
        .post(`/payment-gateway/webhooks/stripe/${storeId}`)
        .set("Stripe-Signature", forgedHeader)
        .set("Content-Type", "application/json")
        .send(payload);
      expect(res.status).toBe(400);

      const refreshed = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(refreshed.status).toBe("pending");
    });

    it("confirms the order on a genuine checkout.session.completed, recording the real gateway/transaction ID (not 'manual')", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("stripe-confirm@example.com", "stripe-confirm-store");
      await connectStripe(token, storeId);
      const order = await placeOrder(hostname, token, storeId);
      const orderRow = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });

      const { payload, header } = signedPayload({
        id: "evt_confirm_1",
        type: "checkout.session.completed",
        data: {
          object: {
            payment_status: "paid",
            client_reference_id: order.id,
            payment_intent: "pi_confirm_1",
            amount_total: Math.round(Number(orderRow.totalAmount) * 100),
            currency: orderRow.currency.toLowerCase(),
          },
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/payment-gateway/webhooks/stripe/${storeId}`)
        .set("Stripe-Signature", header)
        .set("Content-Type", "application/json")
        .send(payload);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ received: true });

      const refreshedOrder = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(refreshedOrder.status).toBe("confirmed");

      const payment = await superuser.payment.findFirstOrThrow({ where: { orderId: order.id } });
      expect(payment.gateway).toBe("stripe");
      expect(payment.gatewayTransactionId).toBe("pi_confirm_1");
      expect(payment.rawWebhookPayload).not.toBeNull();
    });

    it("a redelivered (duplicate) event ID is a no-op the second time - markAsPaid never runs twice", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("stripe-dedupe@example.com", "stripe-dedupe-store");
      await connectStripe(token, storeId);
      const order = await placeOrder(hostname, token, storeId);
      const orderRow = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });

      const { payload, header } = signedPayload({
        id: "evt_dedupe_1",
        type: "checkout.session.completed",
        data: {
          object: {
            payment_status: "paid",
            client_reference_id: order.id,
            payment_intent: "pi_dedupe_1",
            amount_total: Math.round(Number(orderRow.totalAmount) * 100),
            currency: orderRow.currency.toLowerCase(),
          },
        },
      });

      const first = await request(app.getHttpServer())
        .post(`/payment-gateway/webhooks/stripe/${storeId}`)
        .set("Stripe-Signature", header)
        .set("Content-Type", "application/json")
        .send(payload);
      expect(first.status).toBe(201);

      // Same exact event, redelivered (Stripe's own retry behavior) -
      // the order is already "confirmed" by now, so if dedupe failed to
      // stop reprocessing, markAsPaid()'s own "not awaiting payment"
      // exception would surface here as a non-2xx.
      const second = await request(app.getHttpServer())
        .post(`/payment-gateway/webhooks/stripe/${storeId}`)
        .set("Stripe-Signature", header)
        .set("Content-Type", "application/json")
        .send(payload);
      expect(second.status).toBe(201);
      expect(second.body).toEqual({ received: true });

      const payments = await superuser.payment.findMany({ where: { orderId: order.id } });
      expect(payments).toHaveLength(1);
    });

    it("refuses to confirm (order stays pending) when the webhook's reported amount doesn't match the order's own total", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("stripe-mismatch@example.com", "stripe-mismatch-store");
      await connectStripe(token, storeId);
      const order = await placeOrder(hostname, token, storeId);

      const { payload, header } = signedPayload({
        id: "evt_mismatch_1",
        type: "checkout.session.completed",
        data: { object: { payment_status: "paid", client_reference_id: order.id, payment_intent: "pi_mismatch_1", amount_total: 100, currency: "pkr" } },
      });

      const res = await request(app.getHttpServer())
        .post(`/payment-gateway/webhooks/stripe/${storeId}`)
        .set("Stripe-Signature", header)
        .set("Content-Type", "application/json")
        .send(payload);
      expect(res.status).toBe(201); // still acknowledged to Stripe - the mismatch is logged, not surfaced as an HTTP error

      const refreshedOrder = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(refreshedOrder.status).toBe("pending");
    });
  });
});
