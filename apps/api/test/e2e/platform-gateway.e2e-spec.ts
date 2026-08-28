import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { BankTransferGatewayAdapter } from "../../src/payment-gateway/adapters/bank-transfer-gateway.adapter";
import { EasypaisaGatewayAdapter } from "../../src/payment-gateway/adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "../../src/payment-gateway/adapters/jazzcash-gateway.adapter";
import { RaastGatewayAdapter } from "../../src/payment-gateway/adapters/raast-gateway.adapter";
import { PlatformGatewayReconciliationService } from "../../src/platform-gateway/platform-gateway-reconciliation.service";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Founder-directed scope addition - "Platform Merchant Connection": the
 * same Module 62 adapter architecture, but UZEYN itself is the connected
 * merchant, gating automatic verification of a seller's own plan-fee
 * payment / Premium Motion Templates purchase. Same "no live sandbox"
 * reasoning as module62-payment-gateway-connect.e2e-spec.ts - all four
 * adapters are overridden with fakes this file controls.
 */
describe("Platform Merchant Connection (e2e) - founder-directed scope addition", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let fakeEasypaisa: jest.Mocked<EasypaisaGatewayAdapter>;
  let reconciliation: PlatformGatewayReconciliationService;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);

    const fakeRaast = { provider: "raast", verifyPayment: jest.fn() } as unknown as jest.Mocked<RaastGatewayAdapter>;
    fakeEasypaisa = { provider: "easypaisa", verifyPayment: jest.fn() } as unknown as jest.Mocked<EasypaisaGatewayAdapter>;
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
    reconciliation = moduleRef.get(PlatformGatewayReconciliationService);
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

  async function signupLoginSeller(email: string, slug: string) {
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
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, storeId: store.body.id as string, sellerId: seller.id };
  }

  async function fullyVerifiedAdminToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash("admin-password", 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: "admin-password" });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken;
  }

  it("a fresh connection defaults to dormant (isActive false), and credentials are never returned", async () => {
    const adminToken = await fullyVerifiedAdminToken("platform-gw-admin-1@example.com");
    const connect = await request(app.getHttpServer())
      .post("/admin/platform-gateway")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ provider: "easypaisa", merchantId: "UZEYN-MERCHANT-1", apiKey: "real-api-key", apiSecret: "real-api-secret" });
    expect(connect.status).toBe(201);
    expect(connect.body.isActive).toBe(false);
    expect(connect.body.apiKeyEncrypted).toBeUndefined();
    expect(connect.body.apiSecretEncrypted).toBeUndefined();

    const list = await request(app.getHttpServer()).get("/admin/platform-gateway").set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].isActive).toBe(false);
  });

  it("dormant (no active connection): a seller's plan-fee payment with a reference stays on the unchanged manual flow", async () => {
    const { token, sellerId } = await signupLoginSeller("platform-gw-dormant@example.com", "platform-gw-dormant-store");
    const before = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });

    const res = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({ reference: "some-transaction-id" });
    expect(res.status).toBe(201);
    expect(res.body.autoVerified).toBe(false);
    expect(res.body.request.status).toBe("pending");
    expect(fakeEasypaisa.verifyPayment).not.toHaveBeenCalled();

    // Nothing advanced - a dormant gateway must never affect billing state.
    const after = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(after.currentPeriodEnd).toEqual(before.currentPeriodEnd);
  });

  it("active connection + a verified gateway response: plan-fee payment auto-verifies instantly, no admin step, system-attributed", async () => {
    const adminToken = await fullyVerifiedAdminToken("platform-gw-admin-2@example.com");
    await request(app.getHttpServer())
      .post("/admin/platform-gateway")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ provider: "easypaisa", apiKey: "real-api-key" });
    const activate = await request(app.getHttpServer())
      .patch("/admin/platform-gateway/easypaisa/active")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });
    expect(activate.status).toBe(200);
    expect(activate.body.isActive).toBe(true);

    fakeEasypaisa.verifyPayment.mockResolvedValue({ verified: true, providerReference: "EP-TXN-1" });

    const { token, sellerId } = await signupLoginSeller("platform-gw-auto@example.com", "platform-gw-auto-store");
    const res = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({ reference: "EP-TXN-1" });
    expect(res.status).toBe(201);
    expect(res.body.autoVerified).toBe(true);
    expect(res.body.request.status).toBe("verified");
    expect(res.body.request.verifiedBy).toBeNull();
    expect(fakeEasypaisa.verifyPayment).toHaveBeenCalledTimes(1);

    // The real effect - subscription cycle actually advanced, exactly as
    // if an admin had manually verified it.
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscription.currentPeriodEnd).not.toBeNull();

    const connection = await superuser.platformGatewayConnection.findUniqueOrThrow({ where: { provider: "easypaisa" } });
    expect(connection.verifiedCount).toBe(1);
  });

  it("active connection + an unverified gateway response: falls through to the unchanged manual pending flow, not an error", async () => {
    const adminToken = await fullyVerifiedAdminToken("platform-gw-admin-3@example.com");
    await request(app.getHttpServer())
      .post("/admin/platform-gateway")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ provider: "easypaisa", apiKey: "real-api-key" });
    await request(app.getHttpServer())
      .patch("/admin/platform-gateway/easypaisa/active")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });

    fakeEasypaisa.verifyPayment.mockResolvedValue({ verified: false });

    const { token } = await signupLoginSeller("platform-gw-failed@example.com", "platform-gw-failed-store");
    const res = await request(app.getHttpServer())
      .post("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`)
      .send({ reference: "bad-reference" });
    expect(res.status).toBe(201);
    expect(res.body.autoVerified).toBe(false);
    expect(res.body.request.status).toBe("pending");

    // Still resolvable the old way - an admin can manually verify it.
    const adminVerify = await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${res.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminVerify.status).toBe(201);
  });

  it("active connection + verified response: a Premium Motion Template purchase auto-verifies and grants a real entitlement instantly", async () => {
    const adminToken = await fullyVerifiedAdminToken("platform-gw-admin-4@example.com");
    await request(app.getHttpServer())
      .post("/admin/platform-gateway")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ provider: "easypaisa", apiKey: "real-api-key" });
    await request(app.getHttpServer())
      .patch("/admin/platform-gateway/easypaisa/active")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });
    fakeEasypaisa.verifyPayment.mockResolvedValue({ verified: true, providerReference: "EP-TXN-2" });

    const theme = await superuser.theme.create({ data: { name: "Momentum Gateway", tier: "marketplace", price: 2499, isActive: true } });
    const { token, sellerId } = await signupLoginSeller("platform-gw-template@example.com", "platform-gw-template-store");

    const res = await request(app.getHttpServer())
      .post("/sellers/me/template-purchases")
      .set("Authorization", `Bearer ${token}`)
      .send({ themeId: theme.id, reference: "EP-TXN-2" });
    expect(res.status).toBe(201);
    expect(res.body.autoVerified).toBe(true);
    expect(res.body.request.status).toBe("verified");

    const entitlement = await superuser.templateEntitlement.findUnique({ where: { sellerId_themeId: { sellerId, themeId: theme.id } } });
    expect(entitlement?.source).toBe("platform_purchase");
    expect(entitlement?.revokedAt).toBeNull();
  });

  it("admin can deactivate a connection (back to dormant) and remove it entirely", async () => {
    const adminToken = await fullyVerifiedAdminToken("platform-gw-admin-5@example.com");
    await request(app.getHttpServer())
      .post("/admin/platform-gateway")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ provider: "jazzcash", apiKey: "real-api-key" });
    await request(app.getHttpServer())
      .patch("/admin/platform-gateway/jazzcash/active")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });

    const deactivate = await request(app.getHttpServer())
      .patch("/admin/platform-gateway/jazzcash/active")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.isActive).toBe(false);

    const remove = await request(app.getHttpServer())
      .delete("/admin/platform-gateway/jazzcash")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(remove.status).toBe(200);

    const list = await request(app.getHttpServer()).get("/admin/platform-gateway").set("Authorization", `Bearer ${adminToken}`);
    expect(list.body).toHaveLength(0);
  });

  describe("financial-safety hardening (founder-directed, post-build audit)", () => {
    it("idempotency: the same reference can never auto-verify a second, different request", async () => {
      const adminToken = await fullyVerifiedAdminToken("platform-gw-admin-idem@example.com");
      await request(app.getHttpServer())
        .post("/admin/platform-gateway")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ provider: "easypaisa", apiKey: "real-api-key" });
      await request(app.getHttpServer())
        .patch("/admin/platform-gateway/easypaisa/active")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: true });
      fakeEasypaisa.verifyPayment.mockResolvedValue({ verified: true, providerReference: "EP-TXN-REUSED" });

      const theme = await superuser.theme.create({ data: { name: "Reused Reference Template", tier: "marketplace", price: 1999, isActive: true } });
      const { token, sellerId } = await signupLoginSeller("platform-gw-idem@example.com", "platform-gw-idem-store");

      // First submission (plan-fee payment) legitimately consumes the reference.
      const first = await request(app.getHttpServer())
        .post("/sellers/me/wallet/plan-fee-payment")
        .set("Authorization", `Bearer ${token}`)
        .send({ reference: "EP-TXN-REUSED" });
      expect(first.status).toBe(201);
      expect(first.body.autoVerified).toBe(true);

      // Second submission (a DIFFERENT purchase) reuses the same real-world
      // reference - must NOT also auto-grant, even though the gateway would
      // still happily report "verified: true" for that same transaction.
      const second = await request(app.getHttpServer())
        .post("/sellers/me/template-purchases")
        .set("Authorization", `Bearer ${token}`)
        .send({ themeId: theme.id, reference: "EP-TXN-REUSED" });
      expect(second.status).toBe(201);
      expect(second.body.autoVerified).toBe(false);
      expect(second.body.request.status).toBe("pending");

      const entitlement = await superuser.templateEntitlement.findUnique({ where: { sellerId_themeId: { sellerId, themeId: theme.id } } });
      expect(entitlement).toBeNull();

      const consumed = await superuser.platformGatewayConsumedReference.findMany({ where: { reference: "EP-TXN-REUSED" } });
      expect(consumed).toHaveLength(1); // exactly one grant, ever, for this reference
    });

    it("amount mismatch: a gateway-reported amount that doesn't match the requested amount is flagged, never auto-activated", async () => {
      const adminToken = await fullyVerifiedAdminToken("platform-gw-admin-mismatch@example.com");
      await request(app.getHttpServer())
        .post("/admin/platform-gateway")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ provider: "easypaisa", apiKey: "real-api-key" });
      await request(app.getHttpServer())
        .patch("/admin/platform-gateway/easypaisa/active")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: true });
      // Gateway reports the transaction as verified, but for a materially different amount.
      fakeEasypaisa.verifyPayment.mockResolvedValue({ verified: true, providerReference: "EP-TXN-MISMATCH", amount: 1 });

      const { token } = await signupLoginSeller("platform-gw-mismatch@example.com", "platform-gw-mismatch-store");
      const res = await request(app.getHttpServer())
        .post("/sellers/me/wallet/plan-fee-payment")
        .set("Authorization", `Bearer ${token}`)
        .send({ reference: "EP-TXN-MISMATCH" });
      expect(res.status).toBe(201);
      expect(res.body.autoVerified).toBe(false);
      expect(res.body.request.status).toBe("pending");

      const flags = await superuser.platformGatewayFlaggedVerification.findMany({ where: { reason: "amount_mismatch" } });
      expect(flags).toHaveLength(1);
      expect(flags[0].resolved).toBe(false);
      expect(Number(flags[0].gatewayAmount)).toBe(1);

      const consumed = await superuser.platformGatewayConsumedReference.findMany({ where: { reference: "EP-TXN-MISMATCH" } });
      expect(consumed).toHaveLength(0); // never claimed - the request is still open to a legitimate future attempt

      const listFlagged = await request(app.getHttpServer()).get("/admin/platform-gateway/flagged").set("Authorization", `Bearer ${adminToken}`);
      expect(listFlagged.status).toBe(200);
      expect(listFlagged.body).toHaveLength(1);

      const resolve = await request(app.getHttpServer())
        .post(`/admin/platform-gateway/flagged/${flags[0].id}/resolve`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resolve.status).toBe(201);
      const afterResolve = await superuser.platformGatewayFlaggedVerification.findUniqueOrThrow({ where: { id: flags[0].id } });
      expect(afterResolve.resolved).toBe(true);
      expect(afterResolve.resolvedByAdminId).not.toBeNull();
    });

    it("timeout/failure-safe fallback: a thrown gateway error never surfaces as a 500 - falls back to the unchanged manual flow", async () => {
      const adminToken = await fullyVerifiedAdminToken("platform-gw-admin-timeout@example.com");
      await request(app.getHttpServer())
        .post("/admin/platform-gateway")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ provider: "easypaisa", apiKey: "real-api-key" });
      await request(app.getHttpServer())
        .patch("/admin/platform-gateway/easypaisa/active")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: true });
      fakeEasypaisa.verifyPayment.mockRejectedValue(new Error("The operation was aborted due to timeout"));

      const { token } = await signupLoginSeller("platform-gw-timeout@example.com", "platform-gw-timeout-store");
      const res = await request(app.getHttpServer())
        .post("/sellers/me/wallet/plan-fee-payment")
        .set("Authorization", `Bearer ${token}`)
        .send({ reference: "will-time-out" });
      expect(res.status).toBe(201); // never a 500 - the seller's submission itself still succeeds
      expect(res.body.autoVerified).toBe(false);
      expect(res.body.request.status).toBe("pending");

      // Still resolvable the old way.
      const adminVerify = await request(app.getHttpServer())
        .post(`/admin/wallet-topups/${res.body.request.id}/verify`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminVerify.status).toBe(201);
    });

    it("weekly reconciliation sweep: re-polling an auto-verified reference that the gateway no longer confirms gets flagged, not auto-corrected", async () => {
      const adminToken = await fullyVerifiedAdminToken("platform-gw-admin-reconcile@example.com");
      await request(app.getHttpServer())
        .post("/admin/platform-gateway")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ provider: "easypaisa", apiKey: "real-api-key" });
      await request(app.getHttpServer())
        .patch("/admin/platform-gateway/easypaisa/active")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: true });
      fakeEasypaisa.verifyPayment.mockResolvedValue({ verified: true, providerReference: "EP-TXN-RECON" });

      const { token, sellerId } = await signupLoginSeller("platform-gw-reconcile@example.com", "platform-gw-reconcile-store");
      const initial = await request(app.getHttpServer())
        .post("/sellers/me/wallet/plan-fee-payment")
        .set("Authorization", `Bearer ${token}`)
        .send({ reference: "EP-TXN-RECON" });
      expect(initial.body.autoVerified).toBe(true);

      const subscriptionBefore = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });

      // The gateway later reverses/charges back the transaction - a
      // re-poll during the weekly sweep must now report it as no longer verified.
      fakeEasypaisa.verifyPayment.mockResolvedValue({ verified: false });

      const { checked } = await reconciliation.runSweep();
      expect(checked).toBe(1);

      const flags = await superuser.platformGatewayFlaggedVerification.findMany({ where: { reason: "reconciliation_mismatch" } });
      expect(flags).toHaveLength(1);

      // Never auto-corrected - the subscription's already-granted period is untouched.
      const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      expect(subscriptionAfter.currentPeriodEnd).toEqual(subscriptionBefore.currentPeriodEnd);

      // A second sweep run must not re-flag the same still-unresolved reference.
      await reconciliation.runSweep();
      const flagsAfterSecondSweep = await superuser.platformGatewayFlaggedVerification.findMany({ where: { reason: "reconciliation_mismatch" } });
      expect(flagsAfterSecondSweep).toHaveLength(1);
    });
  });
});
