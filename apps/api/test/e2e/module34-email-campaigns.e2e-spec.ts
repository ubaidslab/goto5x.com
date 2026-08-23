import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { EmailCampaignsService } from "../../src/campaigns/email-campaigns.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestSmtpServer, TestSmtpServer } from "./smtp-test-server";

const PASSWORD = "correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";
const SMTP_PORT = 2527;

/**
 * Module 34 (SRS §5.51, §14.51) - Email Campaigns. Sends via the seller's
 * own connected SMTP sender (Module 26's SellerVerificationEmail, reused
 * as-is) to exactly one saved segment (Module 33) - every assertion below
 * proves the quota/unsubscribe/background-job/event-log requirements
 * against a real in-process SMTP server, not a mock.
 */
describe("Email Campaigns (e2e) - SRS §5.51, §14.51", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let smtp: TestSmtpServer;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
    smtp = await startTestSmtpServer(SMTP_PORT);
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
    // Module 75 (§5.6j/FR-7.23) - customer_segments.enabled is now
    // plan-gated (off by default, on for RISE+FLY); a fresh signup starts
    // on GO. This file's whole point is exercising campaigns (which target
    // a segment as setup, not this file's focus), so a seller-scoped
    // override (highest precedence) restores segment-creation access
    // regardless of the signup default tier.
    await app.get(SettingsService).setValue("customer_segments.enabled", "seller", storeRow.sellerId, true, ADMIN_ID);
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com`, sellerId: storeRow.sellerId };
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

  async function checkoutAndPay(token: string, storeId: string, hostname: string, productId: string, variantId: string, buyerEmail: string) {
    const shippingAddress = { fullName: buyerEmail, line1: "House 1", city: "Lahore", country: "PK", phone: "03001234567" };
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail, items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${checkout.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    return checkout.body.id as string;
  }

  async function connectSender(token: string, emailAddress: string) {
    const res = await request(app.getHttpServer())
      .post("/sellers/me/verification-emails")
      .set("Authorization", `Bearer ${token}`)
      .send({ emailAddress, smtpHost: "127.0.0.1", smtpPort: SMTP_PORT, smtpUsername: "user", smtpPassword: "pass" });
    return res.body.id as string;
  }

  it("FR-51.1/51.6/51.7: sends via the connected SMTP sender as a background job, logs a campaign.sent event", async () => {
    const { token, storeId, hostname, sellerId } = await signupLoginAndCreateStore("camp1@example.com", "camp1-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "buyer1@example.com");
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "buyer2@example.com");

    const senderEmailId = await connectSender(token, "campaigns@seller-example.com");
    const segment = await request(app.getHttpServer())
      .post(`/stores/${storeId}/customer-segments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "All buyers", minOrders: 1 });

    const created = await request(app.getHttpServer())
      .post(`/stores/${storeId}/campaigns`)
      .set("Authorization", `Bearer ${token}`)
      .send({ segmentId: segment.body.id, senderEmailId, subject: "Big sale", body: "Everything is 20% off this week." });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("queued");
    expect(created.body.recipientCount).toBe(2);

    // Not yet processed - proves the create() call itself never sends synchronously (FR-51.6).
    expect(smtp.messages).toHaveLength(0);

    // e2e drives the processor directly instead of running a real BullMQ
    // worker process, same precedent as DataExportService.processExport().
    await app.get(EmailCampaignsService).processCampaign(created.body.id);

    expect(smtp.messages).toHaveLength(2);
    expect(smtp.messages[0].from).toBe("campaigns@seller-example.com");
    expect(smtp.messages.map((m) => m.to[0]).sort()).toEqual(["buyer1@example.com", "buyer2@example.com"]);
    expect(smtp.messages[0].subject).toBe("Big sale");
    expect(smtp.messages[0].text).toContain("Unsubscribe:");

    const detail = await request(app.getHttpServer())
      .get(`/stores/${storeId}/campaigns/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.body.status).toBe("sent");
    expect(detail.body.sentCount).toBe(2);
    expect(detail.body.failedCount).toBe(0);

    const events = await superuser.platformEvent.findMany({ where: { eventType: "campaign.sent", entityId: created.body.id } });
    expect(events).toHaveLength(1);
    expect(events[0].storeId).toBe(storeId);
    expect((events[0].metadata as { sentCount: number }).sentCount).toBe(2);
    void sellerId;
  });

  it("FR-51.2: a send exceeding the plan's remaining monthly quota is rejected entirely, never partially sent", async () => {
    const { token, storeId, hostname, sellerId } = await signupLoginAndCreateStore("camp2@example.com", "camp2-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "quota-buyer1@example.com");
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "quota-buyer2@example.com");
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "quota-buyer3@example.com");

    // 2 customers is over this quota (1) - the whole campaign must be blocked, not sent to 1 of 2.
    // Module 75 (§5.6j/FR-7.23) gave GO its own plan-scoped quota (799),
    // which now shadows a global-scoped override entirely (plan beats
    // global in precedence) - seller-scoped (highest precedence) is the
    // only override that actually reaches this seller's resolved quota.
    await app.get(SettingsService).setValue("email_campaigns.monthly_send_limit", "seller", sellerId, 1, ADMIN_ID);

    const senderEmailId = await connectSender(token, "campaigns2@seller-example.com");
    const segment = await request(app.getHttpServer())
      .post(`/stores/${storeId}/customer-segments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "All buyers", minOrders: 1 });

    const rejected = await request(app.getHttpServer())
      .post(`/stores/${storeId}/campaigns`)
      .set("Authorization", `Bearer ${token}`)
      .send({ segmentId: segment.body.id, senderEmailId, subject: "Over quota", body: "Should never send." });
    expect(rejected.status).toBe(400);
    expect(smtp.messages).toHaveLength(0);

    const list = await request(app.getHttpServer())
      .get(`/stores/${storeId}/campaigns`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body).toHaveLength(0);

    // Raise the quota back up - the same campaign now succeeds and consumes it.
    await app.get(SettingsService).setValue("email_campaigns.monthly_send_limit", "seller", sellerId, 500, ADMIN_ID);
    const accepted = await request(app.getHttpServer())
      .post(`/stores/${storeId}/campaigns`)
      .set("Authorization", `Bearer ${token}`)
      .send({ segmentId: segment.body.id, senderEmailId, subject: "Within quota", body: "This one sends." });
    expect(accepted.status).toBe(201);
  });

  it("FR-51.3: unsubscribing excludes a customer from every future send even though they still match the segment", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("camp3@example.com", "camp3-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "loyal-buyer@example.com");
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "other-buyer@example.com");

    const senderEmailId = await connectSender(token, "campaigns3@seller-example.com");
    const segment = await request(app.getHttpServer())
      .post(`/stores/${storeId}/customer-segments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "All buyers", minOrders: 1 });

    const first = await request(app.getHttpServer())
      .post(`/stores/${storeId}/campaigns`)
      .set("Authorization", `Bearer ${token}`)
      .send({ segmentId: segment.body.id, senderEmailId, subject: "Newsletter #1", body: "Hello!" });
    await app.get(EmailCampaignsService).processCampaign(first.body.id);
    expect(smtp.messages).toHaveLength(2);

    const loyalBuyerMessage = smtp.messages.find((m) => m.to[0] === "loyal-buyer@example.com")!;
    const unsubToken = loyalBuyerMessage.text.match(/token=([a-f0-9]+)/)![1];

    const unsubResponse = await request(app.getHttpServer()).post("/storefront/campaigns/unsubscribe").send({ token: unsubToken });
    expect(unsubResponse.status).toBe(201);
    expect(unsubResponse.body.unsubscribed).toBe(true);

    smtp.messages.length = 0;

    // Second campaign to the SAME segment (loyal-buyer still has >=1 orders and would
    // otherwise match) - the unsubscribed customer must never receive it.
    const second = await request(app.getHttpServer())
      .post(`/stores/${storeId}/campaigns`)
      .set("Authorization", `Bearer ${token}`)
      .send({ segmentId: segment.body.id, senderEmailId, subject: "Newsletter #2", body: "Hello again!" });
    expect(second.body.recipientCount).toBe(1);
    await app.get(EmailCampaignsService).processCampaign(second.body.id);

    expect(smtp.messages).toHaveLength(1);
    expect(smtp.messages[0].to[0]).toBe("other-buyer@example.com");

    // Clicking the same unsubscribe link again is a harmless no-op, not an error.
    const unsubAgain = await request(app.getHttpServer()).post("/storefront/campaigns/unsubscribe").send({ token: unsubToken });
    expect(unsubAgain.status).toBe(201);
  });

  it("Phase 4 UI/UX audit fix: GET .../campaigns/quota reports the same monthlyLimit/usedThisMonth/remaining create() itself enforces", async () => {
    const { token, storeId, hostname, sellerId } = await signupLoginAndCreateStore("camp-quota@example.com", "camp-quota-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "quota-preview-buyer1@example.com");
    await checkoutAndPay(token, storeId, hostname, productId, variantId, "quota-preview-buyer2@example.com");
    await app.get(SettingsService).setValue("email_campaigns.monthly_send_limit", "seller", sellerId, 5, ADMIN_ID);

    const before = await request(app.getHttpServer()).get(`/stores/${storeId}/campaigns/quota`).set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ monthlyLimit: 5, usedThisMonth: 0, remaining: 5 });

    const senderEmailId = await connectSender(token, "campaigns-quota@seller-example.com");
    const segment = await request(app.getHttpServer())
      .post(`/stores/${storeId}/customer-segments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "All buyers", minOrders: 1 });
    const created = await request(app.getHttpServer())
      .post(`/stores/${storeId}/campaigns`)
      .set("Authorization", `Bearer ${token}`)
      .send({ segmentId: segment.body.id, senderEmailId, subject: "Quota check", body: "..." });
    await app.get(EmailCampaignsService).processCampaign(created.body.id);

    const after = await request(app.getHttpServer()).get(`/stores/${storeId}/campaigns/quota`).set("Authorization", `Bearer ${token}`);
    expect(after.body).toEqual({ monthlyLimit: 5, usedThisMonth: 2, remaining: 3 });
  });

  it("FR-51.5 tenant isolation: RLS denies cross-tenant access to another store's campaigns", async () => {
    const a = await signupLoginAndCreateStore("camp-tenant-a@example.com", "camp-tenant-a-store");
    const b = await signupLoginAndCreateStore("camp-tenant-b@example.com", "camp-tenant-b-store");
    const { productId, variantId } = await createSelfProduct(a.token, a.storeId, 500);
    await checkoutAndPay(a.token, a.storeId, a.hostname, productId, variantId, "a-buyer@example.com");

    const senderEmailId = await connectSender(a.token, "camptenant@seller-example.com");
    const segment = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/customer-segments`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ name: "A's segment", minOrders: 1 });
    const campaign = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/campaigns`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ segmentId: segment.body.id, senderEmailId, subject: "A's campaign", body: "..." });

    const crossTenantGet = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/campaigns/${campaign.body.id}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossTenantGet.status).toBe(404);
  });
});
