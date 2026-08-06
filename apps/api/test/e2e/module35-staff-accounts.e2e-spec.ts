import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const STAFF_PASSWORD = "staff-horse-battery-9";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Module 35 (SRS §5.52, §14.52) - Staff Accounts, plan-tier. Every
 * assertion below proves the coarse scope model actually restricts
 * what a staff session can reach, that billing/wallet/plan stay
 * owner-only regardless of scope, that the plan-tier limit is real,
 * and that every staff write is tagged in the Platform Event Log.
 */
describe("Staff Accounts (e2e) - SRS §5.52, §14.52", () => {
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
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com`, sellerId: storeRow.sellerId };
  }

  async function createStaff(ownerToken: string, email: string, scopes: string[]) {
    const created = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email, password: STAFF_PASSWORD, scopes });
    const login = await request(app.getHttpServer()).post("/staff/auth/login").send({ email, password: STAFF_PASSWORD });
    return { staffAccountId: created.body.id as string, staffToken: login.body.accessToken as string };
  }

  it("FR-52.5/52.6: zero staff capacity on Free by default; raising the plan-tier limit allows creation up to it", async () => {
    const { token } = await signupLoginAndCreateStore("staff1@example.com", "staff1-store");

    const blockedOnFree = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "hire1@example.com", password: STAFF_PASSWORD, scopes: ["orders"] });
    expect(blockedOnFree.status).toBe(400);
    expect(blockedOnFree.body.message.message).toContain("limit (0)");

    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 2, ADMIN_ID);

    const first = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "hire1@example.com", password: STAFF_PASSWORD, scopes: ["orders"] });
    expect(first.status).toBe(201);
    const second = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "hire2@example.com", password: STAFF_PASSWORD, scopes: ["design"] });
    expect(second.status).toBe(201);

    const third = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "hire3@example.com", password: STAFF_PASSWORD, scopes: ["catalog"] });
    expect(third.status).toBe(400);
    expect(third.body.message.message).toContain("limit (2)");

    const list = await request(app.getHttpServer())
      .get("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body).toHaveLength(2);
    expect(list.body[0].passwordHash).toBeUndefined();
  });

  it("FR-52.2/52.3: a staff session's scope determines exactly which routes it can reach", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("staff2@example.com", "staff2-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    const ordersStaff = await createStaff(token, "orders-hire@example.com", ["orders"]);
    const designStaff = await createStaff(token, "design-hire@example.com", ["design"]);

    // orders-scoped staff can reach orders...
    const ordersOk = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${ordersStaff.staffToken}`);
    expect(ordersOk.status).toBe(200);

    // ...but not the design-only theme customizer.
    const ordersBlockedFromDesign = await request(app.getHttpServer())
      .get(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${ordersStaff.staffToken}`);
    expect(ordersBlockedFromDesign.status).toBe(403);

    // design-scoped staff can reach the customizer...
    const designOk = await request(app.getHttpServer())
      .get(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${designStaff.staffToken}`);
    expect(designOk.status).toBe(200);

    // ...but not orders.
    const designBlockedFromOrders = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${designStaff.staffToken}`);
    expect(designBlockedFromOrders.status).toBe(403);
  });

  it("FR-52.2: billing/payment-instructions/wallet/plan stay owner-only regardless of a staff session's scope", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("staff3@example.com", "staff3-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    // Deliberately scoped to EVERYTHING assignable - still must not reach owner-only surfaces.
    const staff = await createStaff(token, "everything-hire@example.com", ["orders", "catalog", "discounts", "customers", "design"]);

    const wallet = await request(app.getHttpServer())
      .get("/sellers/me/wallet")
      .set("Authorization", `Bearer ${staff.staffToken}`);
    expect(wallet.status).toBe(403);

    const invoices = await request(app.getHttpServer())
      .get("/sellers/me/invoices")
      .set("Authorization", `Bearer ${staff.staffToken}`);
    expect(invoices.status).toBe(403);

    const paymentInstructions = await request(app.getHttpServer())
      .get(`/stores/${storeId}/payment-instructions`)
      .set("Authorization", `Bearer ${staff.staffToken}`);
    expect(paymentInstructions.status).toBe(403);

    const subscription = await request(app.getHttpServer())
      .get("/sellers/me/subscription")
      .set("Authorization", `Bearer ${staff.staffToken}`);
    expect(subscription.status).toBe(403);

    // The owner themselves is completely unaffected.
    const ownerWallet = await request(app.getHttpServer())
      .get("/sellers/me/wallet")
      .set("Authorization", `Bearer ${token}`);
    expect(ownerWallet.status).toBe(200);
  });

  it("FR-52.4: every write a staff session performs is recorded to the Platform Event Log tagged with its staffAccountId", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("staff4@example.com", "staff4-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}`, price: 500, stockQuantity: 100 });
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({
        hostname,
        sessionToken: cart.body.sessionToken,
        shippingAddress: { fullName: "Buyer", line1: "House 1", city: "Lahore", country: "PK", phone: "03001234567" },
      });
    const orderId = checkout.body.id as string;

    const staff = await createStaff(token, "notewriter@example.com", ["orders"]);
    const addNote = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/notes`)
      .set("Authorization", `Bearer ${staff.staffToken}`)
      .send({ body: "Called the buyer to confirm delivery window." });
    expect(addNote.status).toBe(201);

    const events = await superuser.platformEvent.findMany({
      where: { eventType: "staff_account.action", actorId: staff.staffAccountId },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].storeId).toBe(storeId);
    expect((events[0].metadata as { method: string }).method).toBe("POST");

    // A GET made by the same staff session is NOT tagged - only writes are (FR-52.4 says "every write").
    const beforeGetCount = events.length;
    await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${staff.staffToken}`);
    const eventsAfterGet = await superuser.platformEvent.findMany({
      where: { eventType: "staff_account.action", actorId: staff.staffAccountId },
    });
    expect(eventsAfterGet.length).toBe(beforeGetCount);
  });

  it("FR-52.2 revocation: a revoked staff account can no longer log in", async () => {
    const { token } = await signupLoginAndCreateStore("staff5@example.com", "staff5-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    const staff = await createStaff(token, "soon-gone@example.com", ["orders"]);
    const revoke = await request(app.getHttpServer())
      .delete(`/sellers/me/staff-accounts/${staff.staffAccountId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(revoke.status).toBe(200);
    expect(revoke.body.status).toBe("revoked");

    const reLogin = await request(app.getHttpServer())
      .post("/staff/auth/login")
      .send({ email: "soon-gone@example.com", password: STAFF_PASSWORD });
    expect(reLogin.status).toBe(401);
  });
});
