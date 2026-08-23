import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { EmailService } from "../../src/notifications/email.service";
import { GatewayHealthService } from "../../src/payment-gateway/gateway-health.service";
import { PaymentGatewayService } from "../../src/payment-gateway/payment-gateway.service";
import { BankTransferGatewayAdapter } from "../../src/payment-gateway/adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "../../src/payment-gateway/adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "../../src/payment-gateway/adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "../../src/payment-gateway/adapters/raast-gateway.adapter";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * SRS §5.6k (v0.41), FR-6.44 (Module 67) - payment gateway health
 * monitoring: immediate per-checkout stat updates, the 6-hourly sweep,
 * per-provider aggregate rollup, and the once-until-recovery alert gate.
 * Same fake-adapter override pattern as module62-payment-gateway-connect
 * (the real adapters call live external APIs with no sandbox to test
 * against).
 */
describe("Payment gateway health monitoring (e2e) - SRS §5.6k/§14.66 (Module 67, FR-6.44)", () => {
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

  async function signup(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, sellerId: seller.id as string };
  }

  async function createStoreWithGateway(token: string, slug: string, provider: "raast" | "easypaisa" = "raast") {
    const store = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${token}`).send({ name: "Store", slug });
    const storeId = store.body.id as string;
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/payment-gateway`)
      .set("Authorization", `Bearer ${token}`)
      .send({ provider, apiKey: "test-key" });
    const connection = await superuser.storePaymentGatewayConnection.findFirstOrThrow({ where: { storeId, provider } });
    return { storeId, connectionId: connection.id as string };
  }

  async function createAndLoginAdmin(email: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  it("FR-6.44: the 6-hourly sweep pings every active connection and updates its rolling counters", async () => {
    const seller = await signup("gwhealth-sweep@example.com");
    const { connectionId } = await createStoreWithGateway(seller.token, "gwhealth-sweep-store");
    // Exactly one connection exists, so exactly one call is made - queuing a
    // second value here would leak, unconsumed, into the next test.
    fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: true });

    const health = app.get(GatewayHealthService);
    const now = new Date();
    const result = await health.runHealthCheckSweep(now);
    expect(result.checked).toBe(1);
    expect(fakeRaast.verifyPayment).toHaveBeenCalledWith(expect.objectContaining({ testMode: true }));

    const connection = await superuser.storePaymentGatewayConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(connection.verifiedCount).toBe(1);
    expect(connection.failedCount).toBe(0);
    expect(connection.lastVerifiedAt).not.toBeNull();
    expect(connection.lastCheckedAt).not.toBeNull();
  });

  it("FR-6.44: a real checkout verification updates the connection's counters immediately, not just on the sweep", async () => {
    const seller = await signup("gwhealth-checkout@example.com");
    const { storeId, connectionId } = await createStoreWithGateway(seller.token, "gwhealth-checkout-store");

    await superuser.seller.update({ where: { id: seller.sellerId }, data: { isTrusted: true, cnicHash: `hash-${seller.sellerId}` } });
    await superuser.storePaymentInstructions.update({ where: { storeId }, data: { codEnabled: true } });
    await superuser.store.update({ where: { id: storeId }, data: { publishedAt: new Date() } });
    const category = await superuser.category.create({ data: { name: "GW Health", slug: `gwhealth-${Date.now()}` } });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ title: "Product", categoryId: category.id, status: "active" });
    await superuser.product.update({ where: { id: product.body.id }, data: { moderationStatus: "approved" } });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ sku: `SKU-${Date.now()}`, price: 500, stockQuantity: 5 });
    const order = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({
        buyerEmail: "buyer@example.com",
        shippingAddress: { fullName: "Buyer", line1: "1 St", city: "Lahore", country: "PK", phone: "03001234567" },
        items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
      });

    fakeRaast.verifyPayment.mockResolvedValueOnce({ verified: true });
    // Exercises the real buyer-facing entry point's core (verifyAndConfirm
    // -> chargeViaGateway -> gatewayHealth.recordResult) directly, the same
    // way BuyerPaymentGatewayController's own "verify" route would - no
    // buyer session/statusLookupToken plumbing needed for this assertion.
    await app.get(PaymentGatewayService).verifyAndConfirm(storeId, order.body.id, "raast");

    const connection = await superuser.storePaymentGatewayConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(connection.verifiedCount).toBe(1);
    expect(connection.lastVerifiedAt).not.toBeNull();
  });

  it("FR-6.44: rollup aggregates verifiedCount/failedCount across every store connected to a provider", async () => {
    const sellerA = await signup("gwhealth-rollup-a@example.com");
    const sellerB = await signup("gwhealth-rollup-b@example.com");
    const a = await createStoreWithGateway(sellerA.token, "gwhealth-rollup-a-store");
    const b = await createStoreWithGateway(sellerB.token, "gwhealth-rollup-b-store");

    await superuser.storePaymentGatewayConnection.update({ where: { id: a.connectionId }, data: { verifiedCount: 9, failedCount: 1 } });
    await superuser.storePaymentGatewayConnection.update({ where: { id: b.connectionId }, data: { verifiedCount: 8, failedCount: 2 } });

    const health = app.get(GatewayHealthService);
    const rollup = await health.getProviderRollup();
    const raast = rollup.find((r) => r.provider === "raast")!;
    expect(raast.verifiedCount).toBe(17);
    expect(raast.failedCount).toBe(3);
    expect(raast.successRatePercent).toBeCloseTo(85, 1);
  });

  it("FR-6.44: crossing below the alert threshold emails + banners every distinct seller connected to that provider exactly once, and never re-sends while still degraded", async () => {
    const seller = await signup("gwhealth-alert@example.com");
    const { connectionId } = await createStoreWithGateway(seller.token, "gwhealth-alert-store");
    // 1 verified / 9 failed = 10% success, well under the 90% default threshold.
    await superuser.storePaymentGatewayConnection.update({ where: { id: connectionId }, data: { verifiedCount: 1, failedCount: 9 } });
    fakeRaast.verifyPayment.mockResolvedValue({ verified: false });

    const emailSpy = jest.spyOn(app.get(EmailService), "sendGatewayHealthAlertEmail");
    const health = app.get(GatewayHealthService);

    const first = await health.runHealthCheckSweep(new Date());
    expect(first.alertedProviders).toEqual(["raast"]);
    expect(emailSpy).toHaveBeenCalledTimes(1);

    const banner = await superuser.platformMessage.findFirst({ where: { targetSellerId: seller.sellerId, channel: "banner" } });
    expect(banner).not.toBeNull();

    const alertState = await superuser.paymentGatewayHealthAlert.findUniqueOrThrow({ where: { provider: "raast" } });
    expect(alertState.alertedAt).not.toBeNull();

    // Still degraded on the next tick - must not re-send.
    const second = await health.runHealthCheckSweep(new Date());
    expect(second.alertedProviders).toEqual([]);
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it("FR-6.44: recovering above the threshold clears the alert gate, so a future re-degradation alerts again", async () => {
    const seller = await signup("gwhealth-recover@example.com");
    const { connectionId } = await createStoreWithGateway(seller.token, "gwhealth-recover-store");
    await superuser.storePaymentGatewayConnection.update({ where: { id: connectionId }, data: { verifiedCount: 1, failedCount: 9 } });
    fakeRaast.verifyPayment.mockResolvedValue({ verified: false });

    const health = app.get(GatewayHealthService);
    await health.runHealthCheckSweep(new Date());
    let alertState = await superuser.paymentGatewayHealthAlert.findUniqueOrThrow({ where: { provider: "raast" } });
    expect(alertState.alertedAt).not.toBeNull();

    // Recovers: enough verified calls push the rate back above 90%.
    await superuser.storePaymentGatewayConnection.update({ where: { id: connectionId }, data: { verifiedCount: 100, failedCount: 1 } });
    fakeRaast.verifyPayment.mockResolvedValue({ verified: true });
    await health.runHealthCheckSweep(new Date());
    alertState = await superuser.paymentGatewayHealthAlert.findUniqueOrThrow({ where: { provider: "raast" } });
    expect(alertState.alertedAt).toBeNull();

    // Degrades again - alerts again (proves the gate actually reset, not just stayed cleared).
    const emailSpy = jest.spyOn(app.get(EmailService), "sendGatewayHealthAlertEmail");
    await superuser.storePaymentGatewayConnection.update({ where: { id: connectionId }, data: { verifiedCount: 1, failedCount: 20 } });
    fakeRaast.verifyPayment.mockResolvedValue({ verified: false });
    const third = await health.runHealthCheckSweep(new Date());
    expect(third.alertedProviders).toEqual(["raast"]);
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it("FR-6.44: the admin System Status page surfaces the per-provider rollup", async () => {
    const adminToken = await createAndLoginAdmin("gwhealth-admin@example.com");
    const status = await request(app.getHttpServer()).get("/admin/system-status").set("Authorization", `Bearer ${adminToken}`);
    expect(status.status).toBe(200);
    expect(Array.isArray(status.body.paymentGatewayHealth)).toBe(true);
    expect(status.body.paymentGatewayHealth.find((r: { provider: string }) => r.provider === "raast")).toBeTruthy();
  });
});
