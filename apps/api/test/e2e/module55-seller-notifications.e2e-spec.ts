import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { DailySalesSummaryService } from "../../src/seller-notifications/daily-sales-summary.service";
import { PlatformNewsletterService } from "../../src/seller-notifications/platform-newsletter.service";
import { EmailService } from "../../src/notifications/email.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Module 55 (SRS §5.62, §14.62) - Seller Notifications: the 4 transactional
 * email hooks (new-order alert, low-stock alert debounce, verification-
 * failure alert, daily sales summary) plus the admin-composed platform
 * newsletter (live opt-out re-check at send time, idempotent unsubscribe).
 * Uses jest.spyOn(EmailService, ...) rather than a real SMTP server, same
 * precedent as module24-seller-data-export.e2e-spec.ts - these all send
 * through the platform's own EmailService (console provider in test env),
 * never a seller-connected sender, so there's no real transport to prove.
 */
describe("Seller Notifications (e2e) - SRS §5.62, §14.62", () => {
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
    jest.restoreAllMocks();
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
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com`, sellerId: seller.id as string, sellerEmail: email };
  }

  async function createSelfProduct(token: string, storeId: string, price: number, stockQuantity = 100) {
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

  async function checkoutOnce(hostname: string, productId: string, variantId: string, buyerEmail = "buyer@example.com", buyerWhatsapp?: string) {
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail, items: [{ productId, variantId, quantity: 1 }] });
    return request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress, buyerWhatsapp });
  }

  async function adjustStock(token: string, storeId: string, variantId: string, type: "increment" | "decrement" | "set", amount: number) {
    return request(app.getHttpServer())
      .post(`/stores/${storeId}/inventory/${variantId}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type, amount, reason: "test adjustment" });
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

  it("FR-62.1: a storefront checkout fires a new-order alert email to the seller with the order's own details", async () => {
    const { token, storeId, hostname, sellerEmail } = await signupLoginAndCreateStore("neworder@example.com", "neworder-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1500);
    const alertSpy = jest.spyOn(app.get(EmailService), "sendNewOrderAlertEmail");

    const checkout = await checkoutOnce(hostname, productId, variantId);
    expect(checkout.status).toBe(201);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [to, storeName, orderNumber, orderUrl, totalAmount] = alertSpy.mock.calls[0];
    expect(to).toBe(sellerEmail);
    expect(storeName).toBe(`Store for ${sellerEmail}`);
    expect(orderNumber).toBe(checkout.body.orderNumber);
    expect(orderUrl).toContain(checkout.body.id);
    expect(totalAmount).toBe("1500");
  });

  it("FR-62.1: a manually-created order (createManualOrder) never fires the seller's own new-order alert", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("manualorder@example.com", "manualorder-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 800);
    const alertSpy = jest.spyOn(app.get(EmailService), "sendNewOrderAlertEmail");

    const manual = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/manual`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        buyerEmail: "walkin@example.com",
        shippingAddress,
        items: [{ productId, variantId, quantity: 1 }],
      });
    expect(manual.status).toBe(201);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("FR-62.1: low-stock alert fires exactly once per dip below threshold, resets on restock, fires again on a second dip", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("lowstock@example.com", "lowstock-store");
    // Default inventory.low_stock_threshold is 5 (inventory.seed.ts).
    const { variantId } = await createSelfProduct(token, storeId, 1000, 10);
    const alertSpy = jest.spyOn(app.get(EmailService), "sendLowStockAlertEmail");

    // 10 -> 6: still above threshold, no alert.
    let res = await adjustStock(token, storeId, variantId, "decrement", 4);
    expect(res.status).toBe(201);
    expect(alertSpy).not.toHaveBeenCalled();

    // 6 -> 5: crosses the threshold - exactly one alert for this dip.
    res = await adjustStock(token, storeId, variantId, "decrement", 1);
    expect(res.status).toBe(201);
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // 5 -> 4: still low - must NOT alert a second time for the same dip.
    res = await adjustStock(token, storeId, variantId, "decrement", 1);
    expect(res.status).toBe(201);
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // Restock back above threshold clears the debounce flag, no new alert fires yet.
    res = await adjustStock(token, storeId, variantId, "set", 10);
    expect(res.status).toBe(201);
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // A second dip below threshold must alert again.
    res = await adjustStock(token, storeId, variantId, "set", 3);
    expect(res.status).toBe(201);
    expect(alertSpy).toHaveBeenCalledTimes(2);

    const variant = await superuser.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.lowStockAlertSentAt).not.toBeNull();
  });

  it("FR-62.1: order-verification max-attempts exhaustion alerts the seller (the sole \"payment/verification event\" trigger, scoped deliberately narrow)", async () => {
    const { token, storeId, hostname, sellerEmail } = await signupLoginAndCreateStore("verifyfail@example.com", "verifyfail-store");
    await superuser.settingsValue.create({
      data: { definitionKey: "orders.verification_channel", scopeType: "store", scopeId: storeId, value: "whatsapp_otp" },
    });
    await superuser.settingsValue.create({
      data: { definitionKey: "orders.verification_otp_max_attempts", scopeType: "store", scopeId: storeId, value: 1 },
    });
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    const alertSpy = jest.spyOn(app.get(EmailService), "sendOrderVerificationFailedEmail");

    const checkout = await checkoutOnce(hostname, productId, variantId, "buyer@example.com", "03001234567");
    expect(checkout.status).toBe(201);
    const orderId = checkout.body.id as string;
    const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });

    expect(alertSpy).not.toHaveBeenCalled();

    const wrongAttempt = await request(app.getHttpServer())
      .post(`/storefront/order-verification/${order.statusLookupToken}/verify`)
      .send({ code: "000000" });
    expect(wrongAttempt.status).toBe(400);

    const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId } });
    expect(verification.status).toBe("failed");

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [to, storeName, orderUrl] = alertSpy.mock.calls[0];
    expect(to).toBe(sellerEmail);
    expect(storeName).toBe(`Store for ${sellerEmail}`);
    expect(orderUrl).toContain(orderId);
  });

  it("FR-62.1: the daily sales summary sweep emails only stores with >=1 confirmed order yesterday, with the correct count/revenue", async () => {
    const withSale = await signupLoginAndCreateStore("dailysummary-sale@example.com", "dailysummary-sale-store");
    const { productId, variantId } = await createSelfProduct(withSale.token, withSale.storeId, 2000);
    const checkout = await checkoutOnce(withSale.hostname, productId, variantId, "summarybuyer@example.com");
    expect(checkout.status).toBe(201);
    await request(app.getHttpServer())
      .post(`/stores/${withSale.storeId}/orders/${checkout.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${withSale.token}`);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await superuser.order.update({ where: { id: checkout.body.id }, data: { placedAt: yesterday } });

    const withoutSale = await signupLoginAndCreateStore("dailysummary-none@example.com", "dailysummary-none-store");

    const summarySpy = jest.spyOn(app.get(EmailService), "sendDailySalesSummaryEmail");
    const result = await app.get(DailySalesSummaryService).runSweep();
    expect(result.emailsSent).toBe(1);

    expect(summarySpy).toHaveBeenCalledTimes(1);
    const [to, storeName, , orderCount, revenue] = summarySpy.mock.calls[0];
    expect(to).toBe(withSale.sellerEmail);
    expect(storeName).toBe(`Store for ${withSale.sellerEmail}`);
    expect(orderCount).toBe(1);
    expect(revenue).toBe("2000.00");
    void withoutSale;
  });

  it("FR-62.2/62.3: a newsletter re-checks opt-out live at send time - a seller who opts out after creation still doesn't receive it", async () => {
    const staysIn = await signupLoginAndCreateStore("newsletter-staysin@example.com", "newsletter-staysin-store");
    const optsOut = await signupLoginAndCreateStore("newsletter-optsout@example.com", "newsletter-optsout-store");

    const adminToken = await createAndLoginAdmin("newsletter-admin@example.com");
    const created = await request(app.getHttpServer())
      .post("/admin/newsletters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "Product update", body: "Here's what's new this month." });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("draft");

    // Opts out AFTER creation, before send - must still be honored (FR-62.3).
    const optOutRes = await request(app.getHttpServer())
      .patch("/sellers/me/newsletter-opt-out")
      .set("Authorization", `Bearer ${optsOut.token}`)
      .send({ newsletterOptOut: true });
    expect(optOutRes.status).toBe(200);
    expect(optOutRes.body.newsletterOptOut).toBe(true);

    const sendSpy = jest.spyOn(app.get(EmailService), "send");
    await app.get(PlatformNewsletterService).processNewsletter(created.body.id);

    const recipients = sendSpy.mock.calls.map((call) => call[0]);
    expect(recipients).toContain(staysIn.sellerEmail);
    expect(recipients).not.toContain(optsOut.sellerEmail);

    const detail = await request(app.getHttpServer())
      .get(`/admin/newsletters/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(detail.body.status).toBe("sent");
    expect(detail.body.sentCount).toBe(1);
    expect(detail.body.failedCount).toBe(0);
  });

  it("FR-62.3: the newsletter unsubscribe link opts a seller out, and clicking it again is a harmless no-op", async () => {
    const seller = await signupLoginAndCreateStore("newsletter-unsub@example.com", "newsletter-unsub-store");
    const adminToken = await createAndLoginAdmin("newsletter-unsub-admin@example.com");
    const created = await request(app.getHttpServer())
      .post("/admin/newsletters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "Heads up", body: "One-time announcement." });

    const sendSpy = jest.spyOn(app.get(EmailService), "send");
    await app.get(PlatformNewsletterService).processNewsletter(created.body.id);
    const call = sendSpy.mock.calls.find((c) => c[0] === seller.sellerEmail)!;
    const body = call[2] as string;
    const token = body.match(/token=([a-f0-9]+)/)![1];

    const before = await superuser.seller.findUniqueOrThrow({ where: { id: seller.sellerId } });
    expect(before.newsletterOptOut).toBe(false);

    const first = await request(app.getHttpServer()).post("/newsletters/unsubscribe").send({ token });
    expect(first.status).toBe(201);
    expect(first.body.unsubscribed).toBe(true);

    const after = await superuser.seller.findUniqueOrThrow({ where: { id: seller.sellerId } });
    expect(after.newsletterOptOut).toBe(true);

    // Idempotent - clicking the same link again is a harmless no-op, not an error.
    const second = await request(app.getHttpServer()).post("/newsletters/unsubscribe").send({ token });
    expect(second.status).toBe(201);
    expect(second.body.unsubscribed).toBe(true);

    const invalid = await request(app.getHttpServer()).post("/newsletters/unsubscribe").send({ token: "not-a-real-token" });
    expect(invalid.status).toBe(404);
  });

  it("FR-62.2 tenant isolation: a seller (non-admin) token cannot reach the admin newsletter endpoints", async () => {
    const seller = await signupLoginAndCreateStore("newsletter-nonadmin@example.com", "newsletter-nonadmin-store");
    const attempt = await request(app.getHttpServer())
      .post("/admin/newsletters")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ subject: "Should be rejected", body: "..." });
    expect(attempt.status).toBe(403);
  });
});
