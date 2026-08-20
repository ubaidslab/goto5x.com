import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestSmtpServer, TestSmtpServer } from "./smtp-test-server";

const PASSWORD = "correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";
const SMTP_PORT = 2526;

/**
 * Module 26 (SRS §3.5, §5.37, §14.37) - Order Verification Channel Adapter.
 * Real Postgres/Redis, and a real in-process SMTP server for the Email OTP
 * channel (same "genuine infrastructure over mocks" reasoning as
 * s3-test-server.ts) - EmailOtpAdapter's actual nodemailer transport is
 * exercised for real, not stubbed.
 */
describe("Order Verification Channel Adapter (e2e) - SRS §3.5/§5.37, §14.37", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let smtp: TestSmtpServer;

  beforeAll(async () => {
    smtp = await startTestSmtpServer(SMTP_PORT);
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
    await smtp.close();
  });

  afterEach(async () => {
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    smtp.messages.length = 0;
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
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com`, sellerId: seller.id as string };
  }

  async function createSelfProduct(token: string, storeId: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Verified Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function setVerificationChannel(storeId: string, channel: string) {
    await superuser.settingsValue.create({
      data: { definitionKey: "orders.verification_channel", scopeType: "store", scopeId: storeId, value: channel },
    });
  }

  async function checkoutOnce(hostname: string, storeId: string, token: string, buyerWhatsapp?: string) {
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress, buyerWhatsapp });
    return checkout;
  }

  it("orders.verification_channel defaults to \"none\" - checkout/mark-as-paid are unaffected when a store never opts in", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("verify-none@example.com", "verify-none-store");
    const checkout = await checkoutOnce(hostname, storeId, token);
    expect(checkout.status).toBe(201);

    const verification = await superuser.orderVerification.findUnique({ where: { orderId: checkout.body.id } });
    expect(verification).toBeNull();

    const markPaid = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${checkout.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    expect(markPaid.status).toBe(201);
    expect(markPaid.body.status).toBe("confirmed");
  });

  it("a seller can read and update their own store's verification channel + message template via the settings endpoint", async () => {
    const { token, storeId, hostname, sellerId } = await signupLoginAndCreateStore("verify-settings@example.com", "verify-settings-store");
    // Module 77 (§5.6j/FR-6.53) - WhatsApp verification is now plan-gated
    // (off by default, on for RUN+); a fresh signup starts on GO. This
    // test's whole point is the settings endpoint's real read/write
    // round-trip, not the gate, so a seller-scoped override (highest
    // precedence) restores access regardless of the signup default tier.
    await app.get(SettingsService).setValue("orders.whatsapp_verification_enabled", "seller", sellerId, true, ADMIN_ID);

    const initial = await request(app.getHttpServer())
      .get(`/stores/${storeId}/verification-settings`)
      .set("Authorization", `Bearer ${token}`);
    expect(initial.status).toBe(200);
    expect(initial.body.channel).toBe("none");

    const updated = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/verification-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ channel: "whatsapp_otp", messageTemplate: "Your code: {{otp}}" });
    expect(updated.status).toBe(200);
    expect(updated.body.channel).toBe("whatsapp_otp");
    expect(updated.body.messageTemplate).toBe("Your code: {{otp}}");

    // The updated setting is actually live for the next checkout, not just
    // reflected back in the response - proves this writes the real
    // Settings Registry key CheckoutService itself resolves.
    const checkout = await checkoutOnce(hostname, storeId, token, "03001234567");
    expect(checkout.status).toBe(201);
    const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId: checkout.body.id } });
    expect(verification.channel).toBe("whatsapp_otp");

    const rejected = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/verification-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ channel: "not_a_real_channel" });
    expect(rejected.status).toBe(400);
  });

  it(
    "whatsapp_otp (FR-37.2): checkout creates a pending verification with a wa.me deep link; mark-as-paid is blocked until " +
      "the buyer submits the correct OTP (FR-37.7, extends the Financial Truth Invariant)",
    async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("verify-whatsapp@example.com", "verify-whatsapp-store");
      await setVerificationChannel(storeId, "whatsapp_otp");

      const checkout = await checkoutOnce(hostname, storeId, token, "+92 300 1234567");
      expect(checkout.status).toBe(201);
      const orderId = checkout.body.id as string;

      const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId } });
      expect(verification.channel).toBe("whatsapp_otp");
      expect(verification.status).toBe("pending");
      expect(verification.otpHash).toBeTruthy();

      // Financial Truth Invariant gate (FR-37.7) - payment alone is not
      // enough; an unverified order can never be marked confirmed.
      const blockedMarkPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(blockedMarkPaid.status).toBe(400);

      const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });

      // The seller's own resend action re-issues a fresh OTP and surfaces a
      // usable wa.me deep link - the only place the plaintext OTP is ever
      // visible, since only its hash is ever persisted (FR-37.2/FR-37.5).
      const sellerResend = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/verification/resend`)
        .set("Authorization", `Bearer ${token}`);
      expect(sellerResend.status).toBe(201);
      expect(sellerResend.body.deepLink).toMatch(/^https:\/\/wa\.me\/923001234567\?text=/);
      // Extract only from the `text=` param, not the whole deep link - the
      // phone number in the `wa.me/<digits>` path segment is itself a run
      // of 6+ digits and would otherwise be matched instead of the OTP.
      const messageText = decodeURIComponent(sellerResend.body.deepLink.split("text=")[1]);
      const otpMatch = messageText.match(/(\d{6})/);
      expect(otpMatch).not.toBeNull();
      const otpCode = otpMatch![1];

      const wrongCode = otpCode === "999999" ? "888888" : "999999";
      const wrongVerify = await request(app.getHttpServer())
        .post(`/storefront/order-verification/${order.statusLookupToken}/verify`)
        .send({ code: wrongCode });
      expect(wrongVerify.status).toBe(400);

      // §14.37's own FTI proof, same pattern orders.e2e-spec.ts already
      // uses: no order.placed event exists while verification is
      // outstanding, regardless of how many (wrong) attempts were made.
      const eventsBeforeVerified = await superuser.platformEvent.findMany({
        where: { eventType: "order.placed", entityId: orderId },
      });
      expect(eventsBeforeVerified).toHaveLength(0);

      const correctVerify = await request(app.getHttpServer())
        .post(`/storefront/order-verification/${order.statusLookupToken}/verify`)
        .send({ code: otpCode });
      expect(correctVerify.status).toBe(201);
      expect(correctVerify.body.status).toBe("verified");

      // FR-37.4/§14.37 audit trail - the moment the FTI gate cleared is
      // recorded on the order's own timeline, same precedent as markAsPaid().
      const timelineAfterVerify = await superuser.orderTimelineEvent.findMany({
        where: { orderId, eventType: "verification_confirmed" },
      });
      expect(timelineAfterVerify).toHaveLength(1);

      const markPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(markPaid.status).toBe(201);
      expect(markPaid.body.status).toBe("confirmed");

      const eventsAfterConfirmed = await superuser.platformEvent.findMany({
        where: { eventType: "order.placed", entityId: orderId },
      });
      expect(eventsAfterConfirmed).toHaveLength(1);
    },
  );

  it("whatsapp_otp: a buyer-triggered resend inside the cooldown window is rejected (FR-37.5) - the seller's own resend is unaffected", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("verify-resend-cooldown@example.com", "verify-resend-cooldown-store");
    await setVerificationChannel(storeId, "whatsapp_otp");
    await superuser.settingsValue.create({
      data: { definitionKey: "orders.verification_otp_resend_cooldown_seconds", scopeType: "store", scopeId: storeId, value: 900 },
    });
    const checkout = await checkoutOnce(hostname, storeId, token, "03001234567");
    const orderId = checkout.body.id as string;
    const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });

    // The very first OTP was just issued at checkout time - a buyer-
    // triggered resend this soon after must be rejected by the cooldown.
    const buyerResend = await request(app.getHttpServer()).post(
      `/storefront/order-verification/${order.statusLookupToken}/resend`,
    );
    expect(buyerResend.status).toBe(400);

    // The seller's own resend action is a trusted, authenticated dashboard
    // action (not the buyer-abuse-prevention path) and is never blocked by
    // this same cooldown.
    const sellerResend = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/verification/resend`)
      .set("Authorization", `Bearer ${token}`);
    expect(sellerResend.status).toBe(201);
  });

  it("whatsapp_otp: submitting the same OTP twice fails the second time - single-use (FR-37.5)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("verify-single-use@example.com", "verify-single-use-store");
    await setVerificationChannel(storeId, "whatsapp_otp");
    const checkout = await checkoutOnce(hostname, storeId, token, "03001234567");
    const orderId = checkout.body.id as string;
    const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });

    const resend = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/verification/resend`)
      .set("Authorization", `Bearer ${token}`);
    const otpCode = decodeURIComponent(resend.body.deepLink.split("text=")[1]).match(/(\d{6})/)![1];

    const first = await request(app.getHttpServer())
      .post(`/storefront/order-verification/${order.statusLookupToken}/verify`)
      .send({ code: otpCode });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/storefront/order-verification/${order.statusLookupToken}/verify`)
      .send({ code: otpCode });
    expect(second.status).toBe(400);
  });

  it("whatsapp_otp: wrong-code submissions are retry-capped (FR-37.5)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("verify-retry-cap@example.com", "verify-retry-cap-store");
    await setVerificationChannel(storeId, "whatsapp_otp");
    // Tighten the cap so the test doesn't need 5+ requests to exercise it.
    await superuser.settingsValue.create({
      data: { definitionKey: "orders.verification_otp_max_attempts", scopeType: "store", scopeId: storeId, value: 3 },
    });
    const checkout = await checkoutOnce(hostname, storeId, token, "03001234567");
    const orderId = checkout.body.id as string;
    const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });

    for (let i = 0; i < 3; i++) {
      const attempt = await request(app.getHttpServer())
        .post(`/storefront/order-verification/${order.statusLookupToken}/verify`)
        .send({ code: "000000" });
      expect(attempt.status).toBe(400);
    }

    const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId } });
    expect(verification.status).toBe("failed");
  });

  it("whatsapp_otp: an expired OTP is rejected even with the correct code (FR-37.5)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("verify-expiry@example.com", "verify-expiry-store");
    await setVerificationChannel(storeId, "whatsapp_otp");
    const checkout = await checkoutOnce(hostname, storeId, token, "03001234567");
    const orderId = checkout.body.id as string;
    const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });
    const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId } });

    await superuser.orderVerification.update({
      where: { orderId },
      data: { otpExpiresAt: new Date(Date.now() - 1000) },
    });

    const attempt = await request(app.getHttpServer())
      .post(`/storefront/order-verification/${order.statusLookupToken}/verify`)
      .send({ code: "123456" });
    expect(attempt.status).toBe(400);
    // HttpExceptionFilter nests the Nest-generated body under `message`
    // (`{ statusCode, message: { statusCode, error, message } }`) - same
    // shape as every other BadRequestException response in this app.
    expect(attempt.body.message.message).toMatch(/expired/i);

    const after = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId } });
    expect(after.status).toBe("expired");
    void verification;
  });

  it(
    "email_otp (FR-37.3): checkout requires a connected sender email; once connected, checkout sends a real OTP email " +
      "through the seller's own SMTP credentials, never the platform's EmailService",
    async () => {
      const { token, storeId, hostname, sellerId } = await signupLoginAndCreateStore("verify-email@example.com", "verify-email-store");
      await setVerificationChannel(storeId, "email_otp");

      // No sender connected yet - checkout must hard-block (§5.37/FR-37.1's
      // "store readiness" gate), the same style already used for payment
      // instructions/CNIC/publish.
      const blockedCheckout = await checkoutOnce(hostname, storeId, token);
      expect(blockedCheckout.status).toBe(400);

      const connect = await request(app.getHttpServer())
        .post("/sellers/me/verification-emails")
        .set("Authorization", `Bearer ${token}`)
        .send({
          emailAddress: "orders@seller-example.com",
          smtpHost: "127.0.0.1",
          smtpPort: SMTP_PORT,
          smtpUsername: "orders@seller-example.com",
          smtpPassword: "app-password-123",
        });
      expect(connect.status).toBe(201);
      expect(JSON.stringify(connect.body)).not.toContain("app-password-123");

      const checkout = await checkoutOnce(hostname, storeId, token);
      expect(checkout.status).toBe(201);
      const orderId = checkout.body.id as string;

      const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId } });
      expect(verification.channel).toBe("email_otp");
      expect(verification.senderEmailId).toBeTruthy();

      // A real SMTP send, through the seller's own connected sender - never
      // the platform's own EMAIL_PROVIDER (FR-37.3's whole point).
      expect(smtp.messages).toHaveLength(1);
      expect(smtp.messages[0].from).toBe("orders@seller-example.com");
      expect(smtp.messages[0].to).toEqual(["buyer@example.com"]);
      const otpCode = smtp.messages[0].text.match(/(\d{6})/)![1];

      const sender = await superuser.sellerVerificationEmail.findFirstOrThrow({ where: { sellerId } });
      expect(sender.dailySendCount).toBe(1);

      const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });
      const verify = await request(app.getHttpServer())
        .post(`/storefront/order-verification/${order.statusLookupToken}/verify`)
        .send({ code: otpCode });
      expect(verify.status).toBe(201);

      const markPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(markPaid.status).toBe(201);
    },
  );

  it("email_otp: a seller can connect at most 5 sender emails (FR-37.3)", async () => {
    const { token } = await signupLoginAndCreateStore("verify-email-cap@example.com", "verify-email-cap-store");
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post("/sellers/me/verification-emails")
        .set("Authorization", `Bearer ${token}`)
        .send({
          emailAddress: `sender${i}@example.com`,
          smtpHost: "127.0.0.1",
          smtpPort: SMTP_PORT,
          smtpUsername: `sender${i}@example.com`,
          smtpPassword: "app-password",
        });
      expect(res.status).toBe(201);
    }
    const sixth = await request(app.getHttpServer())
      .post("/sellers/me/verification-emails")
      .set("Authorization", `Bearer ${token}`)
      .send({
        emailAddress: "sender5@example.com",
        smtpHost: "127.0.0.1",
        smtpPort: SMTP_PORT,
        smtpUsername: "sender5@example.com",
        smtpPassword: "app-password",
      });
    expect(sixth.status).toBe(400);
  });

  it("email_otp: a revoked sender email is excluded from list() and never picked for rotation", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("verify-email-revoke@example.com", "verify-email-revoke-store");
    await setVerificationChannel(storeId, "email_otp");
    const connect = await request(app.getHttpServer())
      .post("/sellers/me/verification-emails")
      .set("Authorization", `Bearer ${token}`)
      .send({
        emailAddress: "orders@seller-example.com",
        smtpHost: "127.0.0.1",
        smtpPort: SMTP_PORT,
        smtpUsername: "orders@seller-example.com",
        smtpPassword: "app-password-123",
      });

    const revoke = await request(app.getHttpServer())
      .delete(`/sellers/me/verification-emails/${connect.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(revoke.status).toBe(200);

    const list = await request(app.getHttpServer())
      .get("/sellers/me/verification-emails")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.find((s: any) => s.id === connect.body.id).status).toBe("revoked");

    // No active sender remains, so checkout must hard-block again.
    const checkout = await checkoutOnce(hostname, storeId, token);
    expect(checkout.status).toBe(400);
  });

  it("email_otp: a sender at its daily cap is skipped in favor of another connected, uncapped sender (FR-37.3)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore(
      "verify-email-rotation@example.com",
      "verify-email-rotation-store",
    );
    await setVerificationChannel(storeId, "email_otp");
    await superuser.settingsValue.create({
      data: { definitionKey: "orders.verification_email_daily_send_cap", scopeType: "store", scopeId: storeId, value: 1 },
    });

    const cappedSender = await request(app.getHttpServer())
      .post("/sellers/me/verification-emails")
      .set("Authorization", `Bearer ${token}`)
      .send({
        emailAddress: "capped@seller-example.com",
        smtpHost: "127.0.0.1",
        smtpPort: SMTP_PORT,
        smtpUsername: "capped@seller-example.com",
        smtpPassword: "app-password",
      });
    // Simulate this sender having already hit today's cap before either
    // checkout in this test ever runs.
    await superuser.sellerVerificationEmail.update({
      where: { id: cappedSender.body.id },
      data: { dailySendCount: 1 },
    });
    const freshSender = await request(app.getHttpServer())
      .post("/sellers/me/verification-emails")
      .set("Authorization", `Bearer ${token}`)
      .send({
        emailAddress: "fresh@seller-example.com",
        smtpHost: "127.0.0.1",
        smtpPort: SMTP_PORT,
        smtpUsername: "fresh@seller-example.com",
        smtpPassword: "app-password",
      });

    const checkout = await checkoutOnce(hostname, storeId, token);
    expect(checkout.status).toBe(201);
    const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId: checkout.body.id } });
    expect(verification.senderEmailId).toBe(freshSender.body.id);
    expect(smtp.messages[0].from).toBe("fresh@seller-example.com");

    // Push the fresh sender to its cap too - now checkout must hard-block,
    // never silently drop the OTP send.
    await superuser.sellerVerificationEmail.update({ where: { id: freshSender.body.id }, data: { dailySendCount: 1 } });
    const blockedCheckout = await checkoutOnce(hostname, storeId, token);
    expect(blockedCheckout.status).toBe(400);
  });

  it(
    "prepaid_confirmation (FR-37.4): checkout creates a pending verification with no OTP; mark-as-paid stays blocked " +
      "until the seller manually marks the deposit received - the same human-in-the-loop shape as mark-as-paid itself",
    async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("verify-prepaid@example.com", "verify-prepaid-store");
      await setVerificationChannel(storeId, "prepaid_confirmation");

      const checkout = await checkoutOnce(hostname, storeId, token);
      expect(checkout.status).toBe(201);
      const orderId = checkout.body.id as string;

      const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId } });
      expect(verification.channel).toBe("prepaid_confirmation");
      expect(verification.otpHash).toBeNull();
      expect(verification.otpExpiresAt).toBeNull();

      const blockedMarkPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(blockedMarkPaid.status).toBe(400);

      const markPrepaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/verification/mark-prepaid-received`)
        .set("Authorization", `Bearer ${token}`);
      expect(markPrepaid.status).toBe(201);
      expect(markPrepaid.body.status).toBe("verified");

      const markPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(markPaid.status).toBe(201);
      expect(markPaid.body.status).toBe("confirmed");
    },
  );

  it("tenant isolation: a seller cannot view or act on another seller's order verification", async () => {
    const sellerA = await signupLoginAndCreateStore("verify-tenant-a@example.com", "verify-tenant-a-store");
    const sellerB = await signupLoginAndCreateStore("verify-tenant-b@example.com", "verify-tenant-b-store");
    await setVerificationChannel(sellerA.storeId, "whatsapp_otp");
    const checkout = await checkoutOnce(sellerA.hostname, sellerA.storeId, sellerA.token, "03001234567");
    const orderId = checkout.body.id as string;

    const crossResend = await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/orders/${orderId}/verification/resend`)
      .set("Authorization", `Bearer ${sellerB.token}`);
    expect(crossResend.status).toBe(404);

    const crossStatus = await request(app.getHttpServer())
      .get(`/stores/${sellerA.storeId}/orders/${orderId}/verification`)
      .set("Authorization", `Bearer ${sellerB.token}`);
    expect(crossStatus.status).toBe(404);
  });

  it("tenant isolation: a seller cannot mark another seller's prepaid-confirmation order as deposit-received", async () => {
    const sellerA = await signupLoginAndCreateStore("verify-tenant-prepaid-a@example.com", "verify-tenant-prepaid-a-store");
    const sellerB = await signupLoginAndCreateStore("verify-tenant-prepaid-b@example.com", "verify-tenant-prepaid-b-store");
    await setVerificationChannel(sellerA.storeId, "prepaid_confirmation");
    const checkout = await checkoutOnce(sellerA.hostname, sellerA.storeId, sellerA.token);
    const orderId = checkout.body.id as string;

    const crossMarkPrepaid = await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/orders/${orderId}/verification/mark-prepaid-received`)
      .set("Authorization", `Bearer ${sellerB.token}`);
    expect(crossMarkPrepaid.status).toBe(404);

    const verification = await superuser.orderVerification.findUniqueOrThrow({ where: { orderId } });
    expect(verification.status).toBe("pending");
  });
});
