import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Phase B item 1 (pre-launch audit finding) - rate-limit re-audit across
 * Modules 22-47. A background research pass produced a full controller
 * inventory and flagged gaps against the existing `RateLimitService.
 * enforcePerHour()` mechanism (Module 21's own pattern - see auth.service.ts's
 * login()/signup()). These tests prove each newly-added `enforcePerHour`
 * call actually fires a 429 once its Settings-Registry-resolved limit is
 * exceeded, for a representative sample spanning the founder's five named
 * risk areas (checkout as the highest-severity public gap, storefront
 * unlock, admin MFA verify, bulk email campaigns, admin email) plus one
 * more public write endpoint (gift-card purchase). Each override lowers the
 * relevant `*_rate_limit_per_hour` Settings Registry key directly on its
 * `SettingsDefinition.defaultValue` row - the same value `SettingsService.
 * resolve()` falls through to when no scope override exists - so the test
 * doesn't need to flood a route dozens of times to prove the limit fires.
 */
describe("Phase B item 1 - rate-limit re-audit (Modules 22-47)", () => {
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
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { userId: user.id }, data: { cnicHash: `test-cnic-hash-${user.id}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, sellerId: user.id as string, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function createAndLoginAdmin(email: string): Promise<{ token: string }> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return { token: verify.body.accessToken as string };
  }

  it("checkout is rate-limited by IP (highest-severity gap: public, unauthenticated, creates a real order)", async () => {
    await lowerLimit("orders.checkout_rate_limit_per_hour", 2);
    const { token, storeId, hostname } = await signupLoginAndCreateStore("checkout-rl@example.com", "checkout-rl-store");
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}`, price: 500, stockQuantity: 1000, trackInventory: true });

    const shippingAddress = { fullName: "Bilal Ahmed", line1: "House 7", city: "Karachi", country: "PK", phone: "03001234567" };
    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      const cart = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({
          hostname,
          buyerEmail: "buyer@example.com",
          items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
        });
      const res = await request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("storefront unlock is rate-limited by IP+store (password-gate brute-force, no prior attempt cap)", async () => {
    await lowerLimit("storefront.unlock_rate_limit_per_hour", 2);
    const { storeId, hostname } = await signupLoginAndCreateStore("unlock-rl@example.com", "unlock-rl-store");
    const bcrypt = await import("bcryptjs");
    await superuser.store.update({
      where: { id: storeId },
      data: { accessMode: "password_protected", accessPasswordHash: await bcrypt.hash("shop-secret", 10) },
    });

    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer()).post("/storefront/unlock").send({ hostname, password: "wrong-guess" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("gift card purchase is rate-limited by IP (public, unauthenticated row creation)", async () => {
    await lowerLimit("gift_cards.purchase_rate_limit_per_hour", 2);
    const { hostname } = await signupLoginAndCreateStore("giftcard-rl@example.com", "giftcard-rl-store");

    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post("/storefront/gift-cards/purchase")
        .send({ hostname, amount: 1000, buyerEmail: "buyer@example.com" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("admin MFA verify is rate-limited by admin id+IP (6-digit TOTP code is a genuinely guessable space)", async () => {
    await lowerLimit("auth.mfa_verify_rate_limit_per_hour", 2);
    const bcrypt = await import("bcryptjs");
    const email = "admin-mfa-rl@example.com";
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });

    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post("/admin/auth/mfa/verify")
        .send({ preAuthToken: login.body.preAuthToken, code: "000000" });
      lastStatus = res.status;
    }
    expect(enroll.body.secret).toBeDefined();
    expect(lastStatus).toBe(429);
  });

  it("email campaign creation is rate-limited by seller (bounds burst/cadence, distinct from the existing monthly-volume quota)", async () => {
    await lowerLimit("email_campaigns.create_rate_limit_per_hour", 2);
    const { token, storeId } = await signupLoginAndCreateStore("campaign-rl@example.com", "campaign-rl-store");

    // Deliberately nonexistent segment/sender ids - the rate limit is
    // enforced before either is looked up, so a 429 fires regardless of
    // what those downstream lookups would have returned.
    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post(`/stores/${storeId}/campaigns`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          segmentId: "00000000-0000-4000-8000-000000000001",
          senderEmailId: "00000000-0000-4000-8000-000000000002",
          subject: "Hello",
          body: "Body",
        });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("admin email test-connection is rate-limited by admin id (opens real IMAP+SMTP connections on demand)", async () => {
    await lowerLimit("admin_email.test_connection_rate_limit_per_hour", 2);
    const { token } = await createAndLoginAdmin("admin-email-test-rl@example.com");

    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post("/admin/email/accounts/00000000-0000-4000-8000-000000000099/test-connection")
        .set("Authorization", `Bearer ${token}`)
        .send();
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("admin email reply is rate-limited by admin id (sends a real outbound email via a linked account's SMTP credentials)", async () => {
    await lowerLimit("admin_email.reply_rate_limit_per_hour", 2);
    const { token } = await createAndLoginAdmin("admin-email-reply-rl@example.com");

    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post("/admin/email/reply")
        .set("Authorization", `Bearer ${token}`)
        .send({ accountId: "00000000-0000-4000-8000-000000000099", to: "someone@example.com", subject: "Re", body: "Text" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
