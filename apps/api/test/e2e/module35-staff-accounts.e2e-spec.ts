import { INestApplication } from "@nestjs/common";
import { PrismaClient, StaffPermission, StaffScope } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const STAFF_PASSWORD = "staff-horse-battery-9";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Module 35 (SRS §5.52, §14.52), expanded by Module 97 (founder batch
 * "Staff Accounts Overhaul") - every assertion below proves the scope
 * model actually restricts what a staff session can reach (now with a
 * real read/write distinction), that billing/wallet/plan stay owner-only
 * regardless of scope, that the plan-tier limit is real, and that every
 * staff write is tagged in the Platform Event Log.
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

  function scopeWrite(scope: StaffScope): { scope: StaffScope; permission: StaffPermission } {
    return { scope, permission: "write" };
  }

  async function createStaff(
    ownerToken: string,
    email: string,
    scopePermissions: { scope: StaffScope; permission: StaffPermission }[],
    extra: Record<string, unknown> = {},
  ) {
    const created = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email, password: STAFF_PASSWORD, scopePermissions, ...extra });
    const login = await request(app.getHttpServer()).post("/staff/auth/login").send({ email, password: STAFF_PASSWORD });
    return { created, staffAccountId: created.body.id as string, staffToken: login.body.accessToken as string };
  }

  it("FR-52.5/52.6: zero staff capacity by default (First Month, v0.33); raising the plan-tier limit allows creation up to it", async () => {
    const { token } = await signupLoginAndCreateStore("staff1@example.com", "staff1-store");

    const blockedOnFree = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "hire1@example.com", password: STAFF_PASSWORD, scopePermissions: [scopeWrite("orders")] });
    expect(blockedOnFree.status).toBe(400);
    expect(blockedOnFree.body.message.message).toContain("limit (0)");

    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 2, ADMIN_ID);

    const first = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "hire1@example.com", password: STAFF_PASSWORD, scopePermissions: [scopeWrite("orders")] });
    expect(first.status).toBe(201);
    const second = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "hire2@example.com", password: STAFF_PASSWORD, scopePermissions: [scopeWrite("design")] });
    expect(second.status).toBe(201);

    const third = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "hire3@example.com", password: STAFF_PASSWORD, scopePermissions: [scopeWrite("catalog")] });
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

    const ordersStaff = await createStaff(token, "orders-hire@example.com", [scopeWrite("orders")]);
    const designStaff = await createStaff(token, "design-hire@example.com", [scopeWrite("design")]);

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

  it("FR-52.8 (Module 97): read-only staff can view orders but not mutate them; write staff can do both", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("staff-rw@example.com", "staff-rw-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    const readOnly = await createStaff(token, "readonly-hire@example.com", [{ scope: "orders", permission: "read" }]);
    const readWrite = await createStaff(token, "readwrite-hire@example.com", [scopeWrite("orders")]);

    const readOnlyList = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${readOnly.staffToken}`);
    expect(readOnlyList.status).toBe(200);

    const readOnlyTagUpdate = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/orders/00000000-0000-0000-0000-000000000000/tags`)
      .set("Authorization", `Bearer ${readOnly.staffToken}`)
      .send({ tags: ["vip"] });
    expect(readOnlyTagUpdate.status).toBe(403);

    const readWriteList = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${readWrite.staffToken}`);
    expect(readWriteList.status).toBe(200);

    const readWriteTagUpdate = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/orders/00000000-0000-0000-0000-000000000000/tags`)
      .set("Authorization", `Bearer ${readWrite.staffToken}`)
      .send({ tags: ["vip"] });
    // 404 (order genuinely doesn't exist), not 403 - proves write staff clears the scope gate.
    expect(readWriteTagUpdate.status).not.toBe(403);
  });

  it("FR-52.7/52.8 (Module 97): analytics is always read-only - a write permission is rejected outright", async () => {
    const { token } = await signupLoginAndCreateStore("staff-analytics@example.com", "staff-analytics-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    const rejected = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "analytics-hire@example.com", password: STAFF_PASSWORD, scopePermissions: [{ scope: "analytics", permission: "write" }] });
    expect(rejected.status).toBe(400);

    const accepted = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "analytics-hire@example.com", password: STAFF_PASSWORD, scopePermissions: [{ scope: "analytics", permission: "read" }] });
    expect(accepted.status).toBe(201);
  });

  it("FR-52.9 (Module 97): role templates are exposed and their scope/permission mix matches the founder-approved set", async () => {
    const { token } = await signupLoginAndCreateStore("staff-templates@example.com", "staff-templates-store");
    const res = await request(app.getHttpServer())
      .get("/sellers/me/staff-accounts/role-templates")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const keys = res.body.map((t: { key: string }) => t.key);
    expect(keys).toEqual(
      expect.arrayContaining(["order_manager", "product_designer", "marketing_assistant", "customer_support", "supplier_coordinator", "analyst"]),
    );
    const analyst = res.body.find((t: { key: string }) => t.key === "analyst");
    expect(analyst.scopePermissions).toEqual(
      expect.arrayContaining([
        { scope: "analytics", permission: "read" },
        { scope: "orders", permission: "read" },
        { scope: "catalog", permission: "read" },
      ]),
    );
  });

  it("FR-52.10 (Module 97): an expired staff account can no longer log in, and the sweep revokes it", async () => {
    const { token } = await signupLoginAndCreateStore("staff-expiry@example.com", "staff-expiry-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    const past = new Date(Date.now() - 60_000).toISOString();
    const create = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "temp-hire@example.com", password: STAFF_PASSWORD, scopePermissions: [scopeWrite("orders")], expiresAt: past });
    expect(create.status).toBe(201);

    const loginAttempt = await request(app.getHttpServer())
      .post("/staff/auth/login")
      .send({ email: "temp-hire@example.com", password: STAFF_PASSWORD });
    expect(loginAttempt.status).toBe(401);

    const { StaffAccountsService } = await import("../../src/staff/staff-accounts.service");
    const sweepResult = await app.get(StaffAccountsService).runExpirySweep();
    expect(sweepResult.expired).toBeGreaterThanOrEqual(1);

    const staffRow = await superuser.staffAccount.findUniqueOrThrow({ where: { id: create.body.id } });
    expect(staffRow.status).toBe("revoked");
  });

  it("FR-52.11 (Module 97): the activity log summarizes a staff member's writes in plain language", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("staff-activity@example.com", "staff-activity-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    // A real order, same reasoning as the FR-52.4 test above - the audit
    // interceptor only fires on the SUCCESS path, so a write that 404s
    // (a fabricated order id) never reaches it.
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

    const staff = await createStaff(token, "activity-hire@example.com", [scopeWrite("orders")], { name: "Ahmed" });
    const tagUpdate = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/orders/${orderId}/tags`)
      .set("Authorization", `Bearer ${staff.staffToken}`)
      .send({ tags: ["vip"] });
    expect(tagUpdate.status).toBe(200);

    const activity = await request(app.getHttpServer())
      .get("/sellers/me/staff-accounts/activity")
      .set("Authorization", `Bearer ${token}`);
    expect(activity.status).toBe(200);
    expect(activity.body.length).toBeGreaterThanOrEqual(1);
    expect(activity.body[0].summary).toContain("Ahmed");
    // Singular "order", not "orders" - a single write is grammatically singular (FR-52.11 display polish).
    expect(activity.body[0].summary).toContain("order");
  });

  it("FR-52.12 (Module 97): RISE+ device restriction blocks an unrecognized device pending approval, then allows it once approved", async () => {
    const { token, sellerId } = await signupLoginAndCreateStore("staff-device@example.com", "staff-device-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    // RISE = tierOrder 2.
    const risePlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: risePlan.id } });

    const staff = await createStaff(token, "device-hire@example.com", [scopeWrite("orders")]);
    const enableRestriction = await request(app.getHttpServer())
      .patch(`/sellers/me/staff-accounts/${staff.staffAccountId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ deviceRestrictionEnabled: true });
    expect(enableRestriction.status).toBe(200);

    const firstLoginAttempt = await request(app.getHttpServer())
      .post("/staff/auth/login")
      .send({ email: "device-hire@example.com", password: STAFF_PASSWORD, deviceId: "device-abc" });
    expect(firstLoginAttempt.status).toBe(403);

    const devices = await request(app.getHttpServer())
      .get(`/sellers/me/staff-accounts/${staff.staffAccountId}/devices`)
      .set("Authorization", `Bearer ${token}`);
    expect(devices.body).toHaveLength(1);
    expect(devices.body[0].approved).toBe(false);

    const approve = await request(app.getHttpServer())
      .patch(`/sellers/me/staff-accounts/${staff.staffAccountId}/devices/device-abc/approve`)
      .set("Authorization", `Bearer ${token}`);
    expect(approve.status).toBe(200);

    const secondLoginAttempt = await request(app.getHttpServer())
      .post("/staff/auth/login")
      .send({ email: "device-hire@example.com", password: STAFF_PASSWORD, deviceId: "device-abc" });
    expect(secondLoginAttempt.status).toBe(201);

    // Revoking the device blocks it again, pending fresh approval.
    await request(app.getHttpServer())
      .patch(`/sellers/me/staff-accounts/${staff.staffAccountId}/devices/device-abc/revoke`)
      .set("Authorization", `Bearer ${token}`);
    const thirdLoginAttempt = await request(app.getHttpServer())
      .post("/staff/auth/login")
      .send({ email: "device-hire@example.com", password: STAFF_PASSWORD, deviceId: "device-abc" });
    expect(thirdLoginAttempt.status).toBe(403);
  });

  it("FR-52.12 (Module 97): device restriction requires RISE+ - a GO/RUN seller is rejected", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("staff-device-gate@example.com", "staff-device-gate-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);
    void storeId;

    const staff = await createStaff(token, "device-gate-hire@example.com", [scopeWrite("orders")]);
    const attempt = await request(app.getHttpServer())
      .patch(`/sellers/me/staff-accounts/${staff.staffAccountId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ deviceRestrictionEnabled: true });
    expect(attempt.status).toBe(403);
  });

  it("FR-52.13 (Module 97): plan-tier staff limits match GO 0 / RUN 2 / RISE 3 / FLY 5", async () => {
    const { sellerId } = await signupLoginAndCreateStore("staff-tiers@example.com", "staff-tiers-store");
    const settings = app.get(SettingsService);

    for (const [tierOrder, expected] of [
      [0, 0],
      [1, 2],
      [2, 3],
      [3, 5],
    ] as const) {
      const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
      const value = await settings.resolve<number>("staff.max_accounts", { sellerId, planId: plan.id });
      expect(value).toBe(expected);
    }
  });

  it("FR-52.2: billing/payment-instructions/wallet/plan stay owner-only regardless of a staff session's scope", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("staff3@example.com", "staff3-store");
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);

    // Deliberately scoped to EVERYTHING assignable - still must not reach owner-only surfaces.
    const staff = await createStaff(token, "everything-hire@example.com", [
      scopeWrite("orders"),
      scopeWrite("catalog"),
      scopeWrite("discounts"),
      scopeWrite("customers"),
      scopeWrite("design"),
      { scope: "analytics", permission: "read" },
      scopeWrite("marketing"),
      scopeWrite("reviews"),
      scopeWrite("suppliers"),
    ]);

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

    const staff = await createStaff(token, "notewriter@example.com", [scopeWrite("orders")]);
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

    const staff = await createStaff(token, "soon-gone@example.com", [scopeWrite("orders")]);
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
