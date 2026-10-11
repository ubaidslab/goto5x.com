import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { RaastGatewayAdapter } from "../../src/payment-gateway/adapters/raast-gateway.adapter";
import { EasypaisaGatewayAdapter } from "../../src/payment-gateway/adapters/easypaisa-gateway.adapter";
import { JazzCashGatewayAdapter } from "../../src/payment-gateway/adapters/jazzcash-gateway.adapter";
import { BankTransferGatewayAdapter } from "../../src/payment-gateway/adapters/bank-transfer-gateway.adapter";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

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

  /**
   * Founder item 5 (D99, 2026-10-11) - writes the channel directly,
   * bypassing updateSettingsForStore()'s own save-time live-gateway gate.
   * Needed because that gate now makes setChannel("prepaid_partial_advance")
   * fail via the public endpoint whenever there's no live gateway - which,
   * platform-wide today (D95/D86), is always. The "Checkout readiness"/
   * "verified-partial-payment flow" tests below are about
   * assertChannelReady()'s OWN (separate, pre-existing) gate, so they use
   * this to get the store into the "channel is set, gateway question is
   * what's under test" state directly, same as upgradeToTier() already
   * bypasses the real plan-upgrade/billing flow for its own narrower setup
   * purpose.
   */
  async function forceChannel(storeId: string, channel: string) {
    await app.get(SettingsService).setValue("orders.verification_channel", "store", storeId, channel, ADMIN_ID);
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
    /**
     * Rewritten for founder item 5 (D99, 2026-10-11) - this used to end by
     * asserting a RUN seller's save succeeds (200) with NO gateway
     * connected at all. That was the exact gap item 5 flagged: the save
     * path only checked the plan gate, never live-gateway status (only
     * checkout-time did, via assertChannelReady() - see the "Checkout
     * readiness" describe block below). Now that the save path checks
     * both, a RUN seller with no gateway is correctly blocked too - this
     * test still proves the plan gate fires first/independently (a GO
     * seller is blocked for the plan reason, not the gateway reason), then
     * hands off to the dedicated "save-time live-gateway gate" block below
     * for the new behavior itself.
     */
    it("a GO seller is blocked from configuring the channel (plan gate) regardless of gateway status", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("ppa-gate@example.com", "ppa-gate-store");

      const blocked = await setChannel(token, storeId, "prepaid_partial_advance");
      expect(blocked.status).toBe(403);
      expect(blocked.body.message.message).toBe("Prepaid partial-advance verification is not included in your current plan.");
    });
  });

  describe("Save-time live-gateway gate (founder item 5, D99, 2026-10-11)", () => {
    /**
     * The whole point of this item: a seller could previously SAVE this
     * channel with zero gateway connected and only discover it never works
     * once a real buyer hit checkout (the pre-existing "Checkout readiness"
     * block below). Plan-gated and RUN+, but still blocked at save time -
     * no gateway is "live" anywhere on this platform today (D95/D86, every
     * PaymentGatewayProvider is "verifying"), so this is also the only
     * reachable outcome for this channel right now; see that same
     * constraint already documented on the "has no reachable path today"
     * test further below.
     */
    it("blocks the save itself (not just checkout) when the store has no live gateway connection, with the founder's exact copy", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("ppa-savegate-nogw@example.com", "ppa-savegate-nogw-store");
      await upgradeToTier(sellerId, 1); // RUN - clears the plan gate, isolating this test to the gateway gate

      const blocked = await setChannel(token, storeId, "prepaid_partial_advance");
      expect(blocked.status).toBe(400);
      expect(blocked.body.message.message).toBe("Needs a live payment gateway. Not available yet in your country.");

      // The rejected save never wrote a store-scoped override - the store
      // stays on its default channel, not silently half-saved.
      const stored = await superuser.settingsValue.findFirst({
        where: { definitionKey: "orders.verification_channel", scopeType: "store", scopeId: storeId },
      });
      expect(stored).toBeNull();
    });

    it("an active-but-not-live gateway connection (D95 - 'verifying', not 'live') still blocks the save, same as no connection at all", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("ppa-savegate-verifying@example.com", "ppa-savegate-verifying-store");
      await upgradeToTier(sellerId, 1);
      await connectGateway(token, storeId);

      const blocked = await setChannel(token, storeId, "prepaid_partial_advance");
      expect(blocked.status).toBe(400);
      expect(blocked.body.message.message).toBe("Needs a live payment gateway. Not available yet in your country.");
    });

    it("the settings-read endpoint reports the live-gateway flag so the dashboard can show this gate before the seller ever clicks Save", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("ppa-savegate-read@example.com", "ppa-savegate-read-store");
      await upgradeToTier(sellerId, 1);

      const beforeConnect = await request(app.getHttpServer()).get(`/stores/${storeId}/verification-settings`).set("Authorization", `Bearer ${token}`);
      expect(beforeConnect.body.prepaidPartialAdvanceHasLiveGateway).toBe(false);

      await connectGateway(token, storeId);
      const afterConnect = await request(app.getHttpServer()).get(`/stores/${storeId}/verification-settings`).set("Authorization", `Bearer ${token}`);
      // Still false - raast is "verifying", not "live" (D95/D86) - an
      // active connection alone was never meant to flip this flag.
      expect(afterConnect.body.prepaidPartialAdvanceHasLiveGateway).toBe(false);
    });
  });

  describe("Checkout readiness (FR-37.1 precedent extended to the new channel)", () => {
    it("blocks checkout when the store has no active gateway connection", async () => {
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("ppa-no-gateway@example.com", "ppa-no-gateway-store");
      await upgradeToTier(sellerId, 1);
      await forceChannel(storeId, "prepaid_partial_advance");

      const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
      const cart = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
      const checkout = await request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
      expect(checkout.status).toBe(400);
    });

    it("D95/B3 (2026-10-10) - still blocks checkout even once a gateway is connected, while every gateway is 'verifying'", async () => {
      // Before B3, connecting any gateway (active, regardless of real
      // integration evidence) was enough to satisfy assertChannelReady() -
      // exactly Risk #50, for this channel too. It now also requires
      // isGatewayLive(), so this stays blocked until a provider is
      // promoted to "live" (D86) - this channel (unlike the "advance"
      // payment model) wasn't named in D86's day-one path and has no
      // Manual Transfer fallback (B3b is scoped to "advance" only).
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("ppa-verifying-gw@example.com", "ppa-verifying-gw-store");
      await upgradeToTier(sellerId, 1);
      await forceChannel(storeId, "prepaid_partial_advance");
      await connectGateway(token, storeId);

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
    /**
     * D95/B3 (2026-10-10) - replaces the two tests this block had before
     * B3 ("charges exactly the configured percent..." / "a not-yet-
     * verified partial advance never confirms..."). Both required
     * placeOrder() to succeed under the prepaid_partial_advance channel
     * with a connected gateway first - no longer reachable at all now
     * that assertChannelReady() also requires isGatewayLive() (see the
     * "Checkout readiness" describe block above). The percentage/
     * confirm/verification-row/ledger wiring this used to prove is
     * dormant, not deleted - still real code, unreachable until a
     * provider is promoted to "live" (D86). This channel has no Manual
     * Transfer fallback (B3b is scoped to the "advance" payment model
     * only, not this plan-gated verification channel).
     */
    it("has no reachable path today - checkout itself refuses before any pending partial-advance order can exist", async () => {
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("ppa-verify-gated@example.com", "ppa-verify-gated-store");
      await upgradeToTier(sellerId, 1); // RUN
      await forceChannel(storeId, "prepaid_partial_advance");
      await connectGateway(token, storeId);

      const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
      const cart = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
      const checkout = await request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
      expect(checkout.status).toBe(400);
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
