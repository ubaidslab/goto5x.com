import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { RaastGatewayAdapter } from "../../src/payment-gateway/adapters/raast-gateway.adapter";
import { EasypaisaGatewayAdapter } from "../../src/payment-gateway/adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "../../src/payment-gateway/adapters/jazzcash-gateway.adapter";
import { BankTransferGatewayAdapter } from "../../src/payment-gateway/adapters/bank-transfer-gateway.adapter";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 76 (SRS §5.6j/FR-6.52) - Prepaid Partial-Advance, a new anti-fake-
 * order verification channel: a buyer pays a plan-gated percentage of the
 * order total via the seller's own connected Module 62 gateway; the order
 * auto-confirms on a verified partial payment, the remainder stays COD.
 * Free from RUN upward; GO keeps only email + WhatsApp free. Mirrors
 * module62-payment-gateway-connect.e2e-spec.ts's fake-adapter precedent -
 * the four provider adapters call real external APIs with no live sandbox
 * to test against.
 */
describe("Prepaid Partial-Advance Verification (e2e) - SRS §5.6j, §14.67, FR-6.52", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let fakeRaast: jest.Mocked<RaastGatewayAdapter>;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);

    fakeRaast = { provider: "raast", verifyPayment: jest.fn() } as unknown as jest.Mocked<RaastGatewayAdapter>;
    const fakeEasypaisa = { provider: "easypaisa", verifyPayment: jest.fn() } as unknown as jest.Mocked<EasypaisaGatewayAdapter>;
    const fakeJazzCash = { provider: "jazzcash", verifyPayment: jest.fn() } as unknown as jest.Mocked<JazzCashGatewayAdapter>;
    const fakeBank = { provider: "bank", verifyPayment: jest.fn() } as unknown as jest.Mocked<BankTransferGatewayAdapter>;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RaastGatewayAdapter)
      .useValue(fakeRaast)
      .overrideProvider(EasypaisaGatewayAdapter)
      .useValue(fakeEasypaisa)
      .overrideProvider(JazzCashGatewayAdapter)
      .useValue(fakeJazzCash)
      .overrideProvider(BankTransferGatewayAdapter)
      .useValue(fakeBank)
      .compile();
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
    jest.clearAllMocks();
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
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId as string, hostname: `${slug}.uzeyn.com` };
  }

  async function upgradeToTier(sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: plan.id } });
  }

  async function connectGateway(token: string, storeId: string) {
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/payment-gateway`)
      .set("Authorization", `Bearer ${token}`)
      .send({ provider: "raast", apiKey: "k" });
  }

  async function setChannel(token: string, storeId: string, channel: string) {
    return request(app.getHttpServer())
      .patch(`/stores/${storeId}/verification-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ channel });
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
    expect(checkout.status).toBe(201);
    return checkout.body as { id: string; statusLookupToken: string };
  }

  describe("Plan gate (free from RUN upward)", () => {
    it("a GO seller is blocked from configuring the channel; a RUN seller is not", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("ppa-gate@example.com", "ppa-gate-store");

      const blocked = await setChannel(token, storeId, "prepaid_partial_advance");
      expect(blocked.status).toBe(403);

      await upgradeToTier(sellerId, 1); // RUN
      const allowed = await setChannel(token, storeId, "prepaid_partial_advance");
      expect(allowed.status).toBe(200);
      expect(allowed.body.channel).toBe("prepaid_partial_advance");
    });
  });

  describe("Checkout readiness (FR-37.1 precedent extended to the new channel)", () => {
    it("blocks checkout when the store has no active gateway connection", async () => {
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("ppa-no-gateway@example.com", "ppa-no-gateway-store");
      await upgradeToTier(sellerId, 1);
      await setChannel(token, storeId, "prepaid_partial_advance");

      const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
      const cart = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
      const checkout = await request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
      expect(checkout.status).toBe(400);
    });
  });

  describe("The verified-partial-payment flow", () => {
    it("charges exactly the configured percent (not the full total), auto-confirms the order, and marks the verification row verified", async () => {
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("ppa-verify-ok@example.com", "ppa-verify-ok-store");
      await upgradeToTier(sellerId, 1); // RUN
      await setChannel(token, storeId, "prepaid_partial_advance");
      await connectGateway(token, storeId);

      const order = await placeOrder(hostname, token, storeId, 1000);

      const options = await request(app.getHttpServer()).get(`/storefront/gateway-payment/${order.statusLookupToken}/partial-advance`);
      expect(options.status).toBe(200);
      expect(options.body.amount).toBe(50); // 5% default of 1000
      expect(options.body.providers).toEqual(["raast"]);

      fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: true, providerReference: "RAAST-REF-1" });
      const verify = await request(app.getHttpServer())
        .post(`/storefront/gateway-payment/${order.statusLookupToken}/partial-advance/verify`)
        .send({ provider: "raast", reference: "buyer-provided-ref" });
      expect(verify.status).toBe(201);
      expect(verify.body.status).toBe("confirmed");

      // The gateway was charged the 5% advance, never the full order total.
      expect(fakeRaast.verifyPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 50, orderId: order.id }));

      const persistedOrder = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(persistedOrder.status).toBe("confirmed");

      const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId: order.id } });
      expect(verification.channel).toBe("prepaid_partial_advance");
      expect(verification.status).toBe("verified");

      const ledgerEntries = await superuser.ledgerEntry.findMany({ where: { orderId: order.id } });
      expect(ledgerEntries.some((e) => e.type === "commission_accrued")).toBe(true);

      const timeline = await superuser.orderTimelineEvent.findMany({ where: { orderId: order.id, eventType: "verification_confirmed" } });
      expect(timeline).toHaveLength(1);
    });

    it("a not-yet-verified partial advance never confirms the order", async () => {
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("ppa-verify-fail@example.com", "ppa-verify-fail-store");
      await upgradeToTier(sellerId, 1);
      await setChannel(token, storeId, "prepaid_partial_advance");
      await connectGateway(token, storeId);
      const order = await placeOrder(hostname, token, storeId, 1000);

      fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: false });
      const verify = await request(app.getHttpServer())
        .post(`/storefront/gateway-payment/${order.statusLookupToken}/partial-advance/verify`)
        .send({ provider: "raast" });
      expect(verify.status).toBe(400);

      const persistedOrder = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(persistedOrder.status).toBe("pending");
      const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId: order.id } });
      expect(verification.status).toBe("pending");
    });

    it("rejects the partial-advance verify endpoint for an order using a different verification channel", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("ppa-wrong-channel@example.com", "ppa-wrong-channel-store");
      // Default channel ("none") - this order has no OrderVerification row
      // at all, the same "channel !== prepaid_partial_advance" guard as an
      // order genuinely using a different real channel would hit.
      await connectGateway(token, storeId);
      const order = await placeOrder(hostname, token, storeId, 1000);

      const verify = await request(app.getHttpServer())
        .post(`/storefront/gateway-payment/${order.statusLookupToken}/partial-advance/verify`)
        .send({ provider: "raast" });
      expect(verify.status).toBe(400);
      expect(fakeRaast.verifyPayment).not.toHaveBeenCalled();
    });
  });
});
