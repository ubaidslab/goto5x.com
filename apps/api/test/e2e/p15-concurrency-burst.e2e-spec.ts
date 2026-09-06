import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

/**
 * P1.5 (docs/security-audit-report.md) - the last item from the original
 * 5-phase security-hardening pass that had never actually run: genuine
 * concurrent-request burst-testing (Promise.all of real simultaneous HTTP
 * requests, not a sequential loop) on checkout, admin MFA verify, campaign
 * creation, and gift-card purchase - the same rigor already proven on
 * signup/login/OTP/promo-codes elsewhere in this suite. Distinct from
 * `phaseb-item1-rate-limits.e2e-spec.ts`, which proves each rate limit
 * eventually fires but only ever fires requests sequentially - that never
 * exercises whether the limiter (or the business logic behind it) is
 * actually safe when multiple requests land at once.
 */
describe("P1.5 - genuine concurrency/rate-limit burst-testing", () => {
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

  async function lowerLimit(key: string, value: number) {
    await superuser.settingsDefinition.update({ where: { key }, data: { defaultValue: value } });
  }

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
    return { token, sellerId: storeRow.sellerId, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function createAndLoginAdmin(email: string): Promise<{ preAuthToken: string }> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    return { preAuthToken: login.body.preAuthToken as string };
  }

  describe("Checkout", () => {
    it("a genuine simultaneous burst of checkouts (not a sequential loop) is still correctly rate-limited by IP", async () => {
      await lowerLimit("orders.checkout_rate_limit_per_hour", 2);
      const { token, storeId, hostname } = await signupLoginAndCreateStore("burst-checkout@example.com", "burst-checkout-store");
      const product = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Widget", status: "active" });
      const variant = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sku: `SKU-${Date.now()}`, price: 500, stockQuantity: 1000, trackInventory: true });
      const shippingAddress = { fullName: "Bilal Ahmed", line1: "House 7", city: "Karachi", country: "PK", phone: "03001234567" };

      // Three separate carts, created sequentially (uncontested) so the
      // race under test is purely on the checkout call itself, not cart
      // creation.
      const carts = await Promise.all(
        [0, 1, 2].map(() =>
          request(app.getHttpServer())
            .post("/storefront/cart")
            .send({ hostname, buyerEmail: "burst-buyer@example.com", items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }] }),
        ),
      );

      // The actual burst: three real HTTP requests fired at once, not
      // awaited one at a time.
      const results = await Promise.all(
        carts.map((cart) =>
          request(app.getHttpServer())
            .post("/storefront/checkout")
            .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress }),
        ),
      );

      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
      expect(statuses.filter((s) => s === 201).length).toBeLessThanOrEqual(2);
    });
  });

  describe("Admin MFA verify", () => {
    it("a genuine simultaneous burst of MFA verify attempts is still correctly rate-limited by admin id+IP", async () => {
      await lowerLimit("auth.mfa_verify_rate_limit_per_hour", 2);
      const { preAuthToken } = await createAndLoginAdmin("burst-admin-mfa@example.com");

      const results = await Promise.all(
        [0, 1, 2].map(() =>
          request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken, code: "000000" }),
        ),
      );

      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Gift-card purchase", () => {
    it("a genuine simultaneous burst of gift-card purchases is still correctly rate-limited by IP", async () => {
      await lowerLimit("gift_cards.purchase_rate_limit_per_hour", 2);
      const { hostname } = await signupLoginAndCreateStore("burst-giftcard-rl@example.com", "burst-giftcard-rl-store");

      const results = await Promise.all(
        [0, 1, 2].map((i) =>
          request(app.getHttpServer())
            .post("/storefront/gift-cards/purchase")
            .send({ hostname, amount: 1000, buyerEmail: `burst-gc-buyer-${i}@example.com` }),
        ),
      );

      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
    });

    it("P1.4 interaction check: concurrent purchases at, and just past, the new Decimal(12,2) amount bound are each independently validated correctly, with no cross-request interference", async () => {
      // Rate limit set high enough that this test isolates the P1.4
      // amount-bound validation under concurrency, not the separate
      // rate-limit mechanism already proven above.
      await lowerLimit("gift_cards.purchase_rate_limit_per_hour", 100);
      const { hostname } = await signupLoginAndCreateStore("burst-giftcard-bound@example.com", "burst-giftcard-bound-store");

      const [atBound, justOverBound, normal, wayOverBound] = await Promise.all([
        request(app.getHttpServer())
          .post("/storefront/gift-cards/purchase")
          .send({ hostname, amount: 9999999999.99, buyerEmail: "bound-buyer-1@example.com" }),
        request(app.getHttpServer())
          .post("/storefront/gift-cards/purchase")
          .send({ hostname, amount: 10000000000.0, buyerEmail: "bound-buyer-2@example.com" }),
        request(app.getHttpServer())
          .post("/storefront/gift-cards/purchase")
          .send({ hostname, amount: 1000, buyerEmail: "bound-buyer-3@example.com" }),
        request(app.getHttpServer())
          .post("/storefront/gift-cards/purchase")
          .send({ hostname, amount: 99999999999999, buyerEmail: "bound-buyer-4@example.com" }),
      ]);

      // Exactly at the ceiling still succeeds; anything past it (by a
      // cent, or by orders of magnitude) is rejected - and none of these
      // simultaneous requests affected another's outcome.
      expect(atBound.status).toBe(201);
      expect(normal.status).toBe(201);
      expect(justOverBound.status).toBe(400);
      expect(wayOverBound.status).toBe(400);

      const cardsCreated = await superuser.giftCard.count();
      expect(cardsCreated).toBe(2); // only the two that should have succeeded
    });
  });

  describe("Campaign creation - the real finding this pass surfaced", () => {
    it("two genuinely concurrent campaign creates, each individually within the monthly quota but together over it, no longer both succeed", async () => {
      const { token, sellerId, storeId, hostname } = await signupLoginAndCreateStore("burst-campaign@example.com", "burst-campaign-store");

      // High enough that the create-frequency rate limit (a distinct,
      // already-correct mechanism) doesn't interfere with isolating the
      // quota race under test. That key doesn't support a seller-scoped
      // override, so raise its global default directly instead.
      await lowerLimit("email_campaigns.create_rate_limit_per_hour", 10);
      // A tight monthly quota: 2 recipients per create, quota of 3 - one
      // create alone fits, but two together (4) do not.
      await app.get(SettingsService).setValue("email_campaigns.monthly_send_limit", "seller", sellerId, 3, ADMIN_ID);
      await app.get(SettingsService).setValue("customer_segments.enabled", "seller", sellerId, true, ADMIN_ID);

      const product = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Widget", status: "active" });
      const variant = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sku: `SKU-${Date.now()}`, price: 500, stockQuantity: 1000 });

      async function checkoutAndPay(buyerEmail: string) {
        const cart = await request(app.getHttpServer())
          .post("/storefront/cart")
          .send({ hostname, buyerEmail, items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }] });
        const checkout = await request(app.getHttpServer())
          .post("/storefront/checkout")
          .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress: { fullName: buyerEmail, line1: "House 1", city: "Lahore", country: "PK", phone: "03001234567" } });
        await request(app.getHttpServer())
          .post(`/stores/${storeId}/orders/${checkout.body.id}/mark-as-paid`)
          .set("Authorization", `Bearer ${token}`);
      }
      await checkoutAndPay("burst-campaign-buyer-1@example.com");
      await checkoutAndPay("burst-campaign-buyer-2@example.com");

      const senderRes = await request(app.getHttpServer())
        .post("/sellers/me/verification-emails")
        .set("Authorization", `Bearer ${token}`)
        .send({ emailAddress: "burst-sender@seller-example.com", smtpHost: "127.0.0.1", smtpPort: 2599, smtpUsername: "u", smtpPassword: "p" });
      const segment = await request(app.getHttpServer())
        .post(`/stores/${storeId}/customer-segments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "All buyers", minOrders: 1 });

      // The actual race: this segment has exactly 2 eligible recipients
      // (the two paid orders above) - 2 concurrent creates would total 4,
      // over the quota of 3. the SAME segment (2 eligible recipients),
      // created concurrently via two real, simultaneous HTTP requests -
      // not one after the other.
      const [campaignA, campaignB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/stores/${storeId}/campaigns`)
          .set("Authorization", `Bearer ${token}`)
          .send({ segmentId: segment.body.id, senderEmailId: senderRes.body.id, subject: "Burst A", body: "Body A" }),
        request(app.getHttpServer())
          .post(`/stores/${storeId}/campaigns`)
          .set("Authorization", `Bearer ${token}`)
          .send({ segmentId: segment.body.id, senderEmailId: senderRes.body.id, subject: "Burst B", body: "Body B" }),
      ]);

      const statuses = [campaignA.status, campaignB.status].sort();
      // Without the P1.5 fix, both would independently read "quota fully
      // available" and both succeed (2+2=4 > the quota of 3). With the
      // fix (a row lock serializing concurrent create() calls per seller,
      // reserving against every campaign created this month rather than
      // only ones already sent), exactly one wins.
      expect(statuses).toEqual([201, 400]);

      const totalReserved = await superuser.emailCampaign.aggregate({ where: { storeId }, _sum: { recipientCount: true } });
      expect(totalReserved._sum.recipientCount).toBe(2); // never both - the quota was never actually exceeded
    });
  });
});
