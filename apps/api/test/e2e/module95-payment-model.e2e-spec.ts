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
 * Module 95 (SRS §5.6l, FR-6.61-6.68) - the store-wide, mutually-exclusive
 * payment model (Prepaid/COD/Advance). Mirrors module76-prepaid-partial-
 * advance.e2e-spec.ts's fake-adapter precedent - the four provider adapters
 * call real external APIs with no live sandbox to test against.
 */
describe("Store-Wide Payment Model (e2e) - SRS §5.6l, FR-6.61-6.68", () => {
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

  async function setPaymentModel(token: string, storeId: string, paymentModel: string, advancePercent?: number) {
    return request(app.getHttpServer())
      .patch(`/stores/${storeId}/payment-model`)
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentModel, advancePercent });
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

  async function attemptCheckout(hostname: string, token: string, storeId: string, price: number) {
    const { productId, variantId } = await createSelfProduct(token, storeId, price);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    return request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
  }

  describe("Tier gate (Prepaid is RUN+; COD and Advance are free on every tier)", () => {
    it("blocks a GO seller from selecting Prepaid; allows COD and Advance", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("pm-gate@example.com", "pm-gate-store");

      const blocked = await setPaymentModel(token, storeId, "prepaid");
      expect(blocked.status).toBe(403);

      const codOk = await setPaymentModel(token, storeId, "cod");
      expect(codOk.status).toBe(200);

      const advanceOk = await setPaymentModel(token, storeId, "advance", 25);
      expect(advanceOk.status).toBe(200);
      expect(advanceOk.body.advancePercent).toBe(25);
    });

    it("allows a RUN seller to select Prepaid", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("pm-gate-run@example.com", "pm-gate-run-store");
      await upgradeToTier(sellerId, 1);
      const allowed = await setPaymentModel(token, storeId, "prepaid");
      expect(allowed.status).toBe(200);
      expect(allowed.body.paymentModel).toBe("prepaid");
    });
  });

  describe("Checkout readiness gate, per model (FR-6.64)", () => {
    it("cod: unaffected - checkout works with only COD enabled", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("pm-cod@example.com", "pm-cod-store");
      const checkout = await attemptCheckout(hostname, token, storeId, 1000);
      expect(checkout.status).toBe(201);
    });

    it("prepaid: blocked when only COD is enabled (no real instrument)", async () => {
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("pm-prepaid-noinstr@example.com", "pm-prepaid-noinstr-store");
      await upgradeToTier(sellerId, 1);
      await setPaymentModel(token, storeId, "prepaid");
      const checkout = await attemptCheckout(hostname, token, storeId, 1000);
      expect(checkout.status).toBe(400);
    });

    it("prepaid: allowed once manual bank instructions are added", async () => {
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("pm-prepaid-bank@example.com", "pm-prepaid-bank-store");
      await upgradeToTier(sellerId, 1);
      await setPaymentModel(token, storeId, "prepaid");
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ bankAccountTitle: "Store Owner", bankAccountNumber: "PK00BANK0000000000000000", nameDeclaredSelfOwned: true });
      const checkout = await attemptCheckout(hostname, token, storeId, 1000);
      expect(checkout.status).toBe(201);
    });

    it("advance: blocked with no active gateway connection", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("pm-advance-nogw@example.com", "pm-advance-nogw-store");
      await setPaymentModel(token, storeId, "advance", 20);
      const checkout = await attemptCheckout(hostname, token, storeId, 1000);
      expect(checkout.status).toBe(400);
    });

    it("advance: allowed once a gateway is connected", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("pm-advance-gw@example.com", "pm-advance-gw-store");
      await setPaymentModel(token, storeId, "advance", 20);
      await connectGateway(token, storeId);
      const checkout = await attemptCheckout(hostname, token, storeId, 1000);
      expect(checkout.status).toBe(201);
    });
  });

  describe("Cross-setting rule (FR-6.67) - Advance model vs. the prepaid_partial_advance verification channel", () => {
    it("rejects switching the payment model to Advance while that verification channel is already active", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("pm-cross-a@example.com", "pm-cross-a-store");
      await upgradeToTier(sellerId, 1);
      await setChannel(token, storeId, "prepaid_partial_advance");

      const attempt = await setPaymentModel(token, storeId, "advance", 20);
      expect(attempt.status).toBe(400);
    });

    it("rejects switching the verification channel to prepaid_partial_advance while the payment model is already Advance", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("pm-cross-b@example.com", "pm-cross-b-store");
      await upgradeToTier(sellerId, 1);
      await setPaymentModel(token, storeId, "advance", 20);

      const attempt = await setChannel(token, storeId, "prepaid_partial_advance");
      expect(attempt.status).toBe(400);
    });
  });

  describe("The Advance payment model's own charge-and-confirm flow (FR-6.66)", () => {
    it("charges exactly the configured model percentage (not the anti-fraud default), confirms the order, and snapshots paymentModel onto the order", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("pm-flow-ok@example.com", "pm-flow-ok-store");
      await setPaymentModel(token, storeId, "advance", 30);
      await connectGateway(token, storeId);

      const checkout = await attemptCheckout(hostname, token, storeId, 1000);
      expect(checkout.status).toBe(201);
      const order = checkout.body as { id: string; statusLookupToken: string };

      const persistedBefore = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(persistedBefore.paymentModel).toBe("advance");

      const options = await request(app.getHttpServer()).get(`/storefront/gateway-payment/${order.statusLookupToken}/model-advance`);
      expect(options.status).toBe(200);
      expect(options.body.amount).toBe(300); // 30% of 1000, not orders.prepaid_partial_advance_percent's 5%
      expect(options.body.providers).toEqual(["raast"]);

      fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: true, providerReference: "RAAST-REF-1" });
      const verify = await request(app.getHttpServer())
        .post(`/storefront/gateway-payment/${order.statusLookupToken}/model-advance/verify`)
        .send({ provider: "raast", reference: "buyer-provided-ref" });
      expect(verify.status).toBe(201);
      expect(verify.body.status).toBe("confirmed");

      expect(fakeRaast.verifyPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 300, orderId: order.id }));

      const persistedAfter = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(persistedAfter.status).toBe("confirmed");

      // No OrderVerification row is touched by this flow (FR-6.66's "the two 'advance' concepts stay architecturally separate").
      const verification = await superuser.orderVerification.findUnique({ where: { orderId: order.id } });
      expect(verification).toBeNull();
    });

    it("a not-yet-verified charge never confirms the order", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("pm-flow-fail@example.com", "pm-flow-fail-store");
      await setPaymentModel(token, storeId, "advance", 20);
      await connectGateway(token, storeId);
      const checkout = await attemptCheckout(hostname, token, storeId, 1000);
      const order = checkout.body as { id: string; statusLookupToken: string };

      fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: false });
      const verify = await request(app.getHttpServer())
        .post(`/storefront/gateway-payment/${order.statusLookupToken}/model-advance/verify`)
        .send({ provider: "raast" });
      expect(verify.status).toBe(400);

      const persisted = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(persisted.status).toBe("pending");
    });

    it("rejects the model-advance verify endpoint for an order that wasn't placed under the Advance model", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("pm-flow-wrong@example.com", "pm-flow-wrong-store");
      // Default model (cod) - this order's paymentModel snapshot is "cod".
      const checkout = await attemptCheckout(hostname, token, storeId, 1000);
      const order = checkout.body as { id: string; statusLookupToken: string };

      const verify = await request(app.getHttpServer())
        .post(`/storefront/gateway-payment/${order.statusLookupToken}/model-advance/verify`)
        .send({ provider: "raast" });
      expect(verify.status).toBe(400);
      expect(fakeRaast.verifyPayment).not.toHaveBeenCalled();
    });
  });

  describe("Model switches are forward-only (FR-6.65) - never reinterpret an in-flight order", () => {
    it("an order placed under COD keeps its snapshot after the store later switches to Prepaid", async () => {
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("pm-snapshot@example.com", "pm-snapshot-store");
      const checkout = await attemptCheckout(hostname, token, storeId, 1000);
      const order = checkout.body as { id: string };

      await upgradeToTier(sellerId, 1);
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ bankAccountTitle: "Store Owner", bankAccountNumber: "PK00BANK0000000000000000", nameDeclaredSelfOwned: true });
      await setPaymentModel(token, storeId, "prepaid");

      const persisted = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(persisted.paymentModel).toBe("cod");

      const store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.paymentModel).toBe("prepaid");
    });
  });
});
