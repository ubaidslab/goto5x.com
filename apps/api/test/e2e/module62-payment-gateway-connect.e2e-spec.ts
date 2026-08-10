import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { BankTransferGatewayAdapter } from "../../src/payment-gateway/adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "../../src/payment-gateway/adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "../../src/payment-gateway/adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "../../src/payment-gateway/adapters/raast-gateway.adapter";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 62 (SRS §5.6h, §14.65 FR-6.36-6.39) - Seller Payment Gateway
 * Connect. The four provider adapters call real external APIs with no live
 * sandbox to test against (RaastGatewayAdapter's own disclosed limitation) -
 * this spec overrides all four with fakes this file controls, the same
 * pattern google-drive.e2e-spec.ts already established for
 * DRIVE_CLIENT, while exercising everything else (credential encryption/
 * SAFE_SELECT, Raast-first ordering, the buyer-facing verify -> markAsPaid()
 * wiring, RLS) for real, against the real app, real Postgres, and real
 * Redis.
 */
describe("Seller Payment Gateway Connect (e2e) - SRS §5.6h, §14.65", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let fakeRaast: jest.Mocked<RaastGatewayAdapter>;
  let fakeEasypaisa: jest.Mocked<EasypaisaGatewayAdapter>;
  let fakeJazzCash: jest.Mocked<JazzCashGatewayAdapter>;
  let fakeBank: jest.Mocked<BankTransferGatewayAdapter>;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);

    fakeRaast = { provider: "raast", verifyPayment: jest.fn() } as unknown as jest.Mocked<RaastGatewayAdapter>;
    fakeEasypaisa = { provider: "easypaisa", verifyPayment: jest.fn() } as unknown as jest.Mocked<EasypaisaGatewayAdapter>;
    fakeJazzCash = { provider: "jazzcash", verifyPayment: jest.fn() } as unknown as jest.Mocked<JazzCashGatewayAdapter>;
    fakeBank = { provider: "bank", verifyPayment: jest.fn() } as unknown as jest.Mocked<BankTransferGatewayAdapter>;

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
      .send({ title: "Gateway Widget", status: "active" });
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
      .send({ hostname, buyerEmail: "gateway-buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);
    return checkout.body as { id: string; statusLookupToken: string };
  }

  describe("FR-6.36: connect/list/toggle/remove, credentials never returned", () => {
    it("connecting a provider round-trips through the seller-facing screen without ever exposing the encrypted credential fields", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("gw-connect@example.com", "gw-connect-store");

      const connect = await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "raast", merchantId: "RAAST-123", apiKey: "secret-api-key", apiSecret: "secret-api-secret" });
      expect(connect.status).toBe(201);
      expect(connect.body.provider).toBe("raast");
      expect(connect.body.merchantId).toBe("RAAST-123");
      expect(JSON.stringify(connect.body)).not.toContain("secret-api-key");
      expect(JSON.stringify(connect.body)).not.toContain("secret-api-secret");
      expect(connect.body.apiKeyEncrypted).toBeUndefined();
      expect(connect.body.apiSecretEncrypted).toBeUndefined();

      const list = await request(app.getHttpServer())
        .get(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
      expect(JSON.stringify(list.body)).not.toContain("secret-api-key");

      // The raw ciphertext itself never contains the plaintext secret either -
      // proves this is genuine encryption, not a no-op passthrough.
      const row = await superuser.storePaymentGatewayConnection.findFirstOrThrow({ where: { storeId } });
      expect(row.apiKeyEncrypted).not.toContain("secret-api-key");
    });

    it("toggling active/inactive and removing a connection both work, and removal is reflected in the list", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("gw-toggle@example.com", "gw-toggle-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "easypaisa", apiKey: "key-1" });

      const deactivate = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-gateway/easypaisa/active`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false });
      expect(deactivate.status).toBe(200);
      expect(deactivate.body.isActive).toBe(false);

      const remove = await request(app.getHttpServer())
        .delete(`/stores/${storeId}/payment-gateway/easypaisa`)
        .set("Authorization", `Bearer ${token}`);
      expect(remove.status).toBe(200);

      const list = await request(app.getHttpServer())
        .get(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`);
      expect(list.body).toHaveLength(0);
    });

    it("reconnecting the same provider updates the existing row rather than creating a duplicate", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("gw-reconnect@example.com", "gw-reconnect-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "jazzcash", merchantId: "OLD-ID", apiKey: "old-key" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "jazzcash", merchantId: "NEW-ID", apiKey: "new-key" });

      const list = await request(app.getHttpServer())
        .get(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].merchantId).toBe("NEW-ID");
    });
  });

  describe("FR-6.36: Raast-first ordering", () => {
    it("connections list in priority order (Raast first) regardless of the order they were connected in", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("gw-order@example.com", "gw-order-store");
      // Deliberately connected out of priority order.
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "bank", apiKey: "k" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "jazzcash", apiKey: "k" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "raast", apiKey: "k" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "easypaisa", apiKey: "k" });

      const list = await request(app.getHttpServer())
        .get(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`);
      expect(list.body.map((c: { provider: string }) => c.provider)).toEqual(["raast", "easypaisa", "jazzcash", "bank"]);
    });
  });

  describe("FR-6.39: test connection", () => {
    it("a successful test-mode call reports success without touching a real order", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("gw-test-ok@example.com", "gw-test-ok-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "raast", apiKey: "k" });
      fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: true });

      const test = await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway/raast/test`)
        .set("Authorization", `Bearer ${token}`);
      expect(test.status).toBe(201);
      expect(test.body.success).toBe(true);
      expect(fakeRaast.verifyPayment).toHaveBeenCalledWith(expect.objectContaining({ testMode: true, orderId: "" }));
    });

    it("a failed test-mode call reports failure", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("gw-test-fail@example.com", "gw-test-fail-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "raast", apiKey: "bad-key" });
      fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: false });

      const test = await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway/raast/test`)
        .set("Authorization", `Bearer ${token}`);
      expect(test.status).toBe(201);
      expect(test.body.success).toBe(false);
    });
  });

  describe("FR-6.38: buyer-facing verify -> the same markAsPaid() core, never a second confirmation path", () => {
    it("a verified gateway payment auto-confirms the order through markAsPaid(), posting the same commission/timeline side effects", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("gw-verify-ok@example.com", "gw-verify-ok-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "raast", apiKey: "k" });
      const order = await placeOrder(hostname, token, storeId);
      fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: true, providerReference: "RAAST-REF-1" });

      const verify = await request(app.getHttpServer())
        .post(`/storefront/gateway-payment/${order.statusLookupToken}/verify`)
        .send({ provider: "raast", reference: "buyer-provided-ref" });
      expect(verify.status).toBe(201);
      expect(verify.body.status).toBe("confirmed");

      const persisted = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(persisted.status).toBe("confirmed");
      const ledgerEntries = await superuser.ledgerEntry.findMany({ where: { orderId: order.id } });
      expect(ledgerEntries.some((e) => e.type === "commission_accrued")).toBe(true);
    });

    it("a not-yet-verified gateway payment never confirms the order - no second confirmation path around markAsPaid()", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("gw-verify-fail@example.com", "gw-verify-fail-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "raast", apiKey: "k" });
      const order = await placeOrder(hostname, token, storeId);
      fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: false });

      const verify = await request(app.getHttpServer())
        .post(`/storefront/gateway-payment/${order.statusLookupToken}/verify`)
        .send({ provider: "raast" });
      expect(verify.status).toBe(400);

      const persisted = await superuser.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(persisted.status).toBe("pending");
    });

    it("the buyer-facing checkout-options endpoint lists only active connections, Raast first", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("gw-options@example.com", "gw-options-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "bank", apiKey: "k" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "raast", apiKey: "k" });
      // Connected but inactive - must not appear in the buyer-facing list.
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "jazzcash", apiKey: "k" });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-gateway/jazzcash/active`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false });
      const order = await placeOrder(hostname, token, storeId);

      const options = await request(app.getHttpServer()).get(`/storefront/gateway-payment/${order.statusLookupToken}`);
      expect(options.status).toBe(200);
      expect(options.body).toEqual(["raast", "bank"]);
    });

    it("manual mark-as-paid still works unchanged for a seller with no gateway connected", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("gw-manual-fallback@example.com", "gw-manual-fallback-store");
      const order = await placeOrder(hostname, token, storeId);

      const markPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${order.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(markPaid.status).toBe(201);
      expect(markPaid.body.status).toBe("confirmed");
    });
  });

  describe("RLS tenant isolation", () => {
    it("denies cross-tenant reads/writes of another store's gateway connections", async () => {
      const a = await signupLoginAndCreateStore("gw-tenant-a@example.com", "gw-tenant-a-store");
      const b = await signupLoginAndCreateStore("gw-tenant-b@example.com", "gw-tenant-b-store");
      await request(app.getHttpServer())
        .post(`/stores/${a.storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ provider: "raast", apiKey: "k" });

      const crossList = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossList.status).toBe(404);

      const crossConnect = await request(app.getHttpServer())
        .post(`/stores/${a.storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ provider: "easypaisa", apiKey: "should-not-apply" });
      expect(crossConnect.status).toBe(404);

      const crossRemove = await request(app.getHttpServer())
        .delete(`/stores/${a.storeId}/payment-gateway/raast`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossRemove.status).toBe(404);

      const stillThere = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/payment-gateway`)
        .set("Authorization", `Bearer ${a.token}`);
      expect(stillThere.body).toHaveLength(1);
    });
  });
});
