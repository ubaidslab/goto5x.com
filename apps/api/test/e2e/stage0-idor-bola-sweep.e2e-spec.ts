import { INestApplication } from "@nestjs/common";
import { PrismaClient, StaffPermission, StaffScope } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const STAFF_PASSWORD = "staff-horse-battery-9";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";
/** Never actually resolved - every admin probe below must be rejected by AdminAuthGuard before any handler/Prisma lookup runs. */
const FAKE_ID = "00000000-0000-0000-0000-0000deadbeef";

const shippingAddress = {
  fullName: "Ayesha Khan",
  line1: "House 12, Street 3",
  city: "Lahore",
  country: "PK",
  phone: "03001234567",
};

/**
 * D116 item 3 (founder decision) - a scoped IDOR/BOLA sweep over exactly the
 * 9 named high-risk route groups (orders, customers, products/stock,
 * payment instructions, store settings, staff, wallet, domains, all admin
 * routes), two dimensions each: cross-tenant (seller A -> seller B) and
 * staff-permission limits. A full per-route sweep across the entire API is
 * a separate, explicitly-deferred effort, not this file.
 *
 * Cross-tenant dimension: every one of the 9 groups gets its own test
 * below, EXCEPT Wallet (already thoroughly covered by
 * module20-wallet-supplier-portal.e2e-spec.ts - see the `it.todo` under
 * group 7) and "all admin routes" (inherently cross-tenant by design, so it
 * gets a denial sweep instead - see group 9).
 *
 * Staff-permission-limit dimension: module35-staff-accounts.e2e-spec.ts
 * already thoroughly covers orders, catalog (products/stock), discounts,
 * and customers scopes, plus proves billing/payment-instructions/wallet/
 * plan stay owner-only regardless of scope. This file only adds the two
 * groups that genuinely have no existing staff-scope coverage today: store
 * settings and domains - and, having read every controller involved
 * directly, both turn out to have NO staff-scope gate at all (see the
 * "GAP" tests at the bottom). The other two groups the founder's ask named
 * for this dimension (customers, products/stock) are `it.todo`'d below
 * with a pointer to the existing coverage, not duplicated.
 */
describe("Stage 0 IDOR/BOLA sweep (D116 item 3) - 9 high-risk route groups", () => {
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

  /** Mirrors orders.e2e-spec.ts's / module35-staff-accounts.e2e-spec.ts's own copy of this helper exactly. */
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
    void user;
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com`, sellerId: storeRow.sellerId as string };
  }

  function scopeWrite(scope: StaffScope): { scope: StaffScope; permission: StaffPermission } {
    return { scope, permission: "write" };
  }

  /** Mirrors module35-staff-accounts.e2e-spec.ts's own copy of this helper exactly. */
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

  async function createSelfProduct(token: string, storeId: string, price: number, stockQuantity = 100) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Self-Fulfilled Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity, trackInventory: true });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  /** FR-17.1 dashboard manual-order path - also the one place a Customer row gets created, so this doubles as this file's Customer-group seed too. */
  async function createManualOrder(token: string, storeId: string, productId: string, variantId: string, buyerEmail: string) {
    const manual = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({ buyerEmail, shippingAddress, items: [{ productId, variantId, quantity: 1 }] });
    return manual.body.id as string;
  }

  // ===== 1. Orders ========================================================
  describe("1. Orders", () => {
    // orders.e2e-spec.ts (~line 748) already strongly covers GET/mark-as-paid
    // cross-tenant isolation; this adds one additional, not-yet-covered
    // route (PATCH :orderId/costs) rather than duplicating that test.
    it("tenant isolation: seller B cannot read or update seller A's order costs", async () => {
      const a = await signupLoginAndCreateStore("idor-orders-a@example.com", "idor-orders-a-store");
      const b = await signupLoginAndCreateStore("idor-orders-b@example.com", "idor-orders-b-store");
      const { productId, variantId } = await createSelfProduct(a.token, a.storeId, 500);
      const orderId = await createManualOrder(a.token, a.storeId, productId, variantId, "idor-order-buyer@example.com");

      const before = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });

      const crossUpdateCosts = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}/orders/${orderId}/costs`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ courierCost: 150, handlingCost: 50 });
      expect(crossUpdateCosts.status).toBe(404);

      const after = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(after.courierCost).toEqual(before.courierCost);
      expect(after.handlingCost).toEqual(before.handlingCost);
      expect(after.status).toBe("pending");
    });
  });

  // ===== 2. Customers ======================================================
  describe("2. Customers", () => {
    it("tenant isolation: seller A's customer list/detail are invisible from seller B's own session", async () => {
      const a = await signupLoginAndCreateStore("idor-customers-a@example.com", "idor-customers-a-store");
      const b = await signupLoginAndCreateStore("idor-customers-b@example.com", "idor-customers-b-store");
      const { productId, variantId } = await createSelfProduct(a.token, a.storeId, 500);
      await createManualOrder(a.token, a.storeId, productId, variantId, "idor-customer-buyer@example.com");
      const customer = await superuser.customer.findFirstOrThrow({ where: { storeId: a.storeId } });

      const crossList = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/customers`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossList.status).toBe(404);

      const crossGetOne = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/customers/${customer.id}`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossGetOne.status).toBe(404);
    });
  });

  // ===== 3. Products & stock ===============================================
  describe("3. Products & stock", () => {
    it("tenant isolation: seller A's product/variant/inventory cannot be read or mutated via seller B's session", async () => {
      const a = await signupLoginAndCreateStore("idor-products-a@example.com", "idor-products-a-store");
      const b = await signupLoginAndCreateStore("idor-products-b@example.com", "idor-products-b-store");
      const { productId, variantId } = await createSelfProduct(a.token, a.storeId, 500, 100);

      const crossGetProduct = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossGetProduct.status).toBe(404);

      const crossUpdateProduct = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}/products/${productId}`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ title: "Hijacked by seller B" });
      expect(crossUpdateProduct.status).toBe(404);

      const crossAdjustStock = await request(app.getHttpServer())
        .post(`/stores/${a.storeId}/inventory/${variantId}/adjust`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ type: "set", amount: 0, reason: "cross-tenant IDOR probe" });
      expect(crossAdjustStock.status).toBe(404);

      const unchangedProduct = await superuser.product.findUniqueOrThrow({ where: { id: productId } });
      expect(unchangedProduct.title).toBe("Self-Fulfilled Widget");
      const unchangedVariant = await superuser.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      expect(unchangedVariant.stockQuantity).toBe(100);
    });
  });

  // ===== 4. Payment instructions ==========================================
  describe("4. Payment instructions", () => {
    it("tenant isolation: seller A cannot read or update seller B's payment instructions", async () => {
      const a = await signupLoginAndCreateStore("idor-payment-instr-a@example.com", "idor-payment-instr-a-store");
      const b = await signupLoginAndCreateStore("idor-payment-instr-b@example.com", "idor-payment-instr-b-store");
      const before = await superuser.storePaymentInstructions.findUniqueOrThrow({ where: { storeId: b.storeId } });

      const crossGet = await request(app.getHttpServer())
        .get(`/stores/${b.storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${a.token}`);
      expect(crossGet.status).toBe(404);

      const crossPatch = await request(app.getHttpServer())
        .patch(`/stores/${b.storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ codEnabled: false, bankAccountTitle: "Hijacked", bankAccountNumber: "0000000000" });
      expect(crossPatch.status).toBe(404);

      const after = await superuser.storePaymentInstructions.findUniqueOrThrow({ where: { storeId: b.storeId } });
      expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    });
  });

  // ===== 5. Store settings (shipping-settings) ============================
  describe("5. Store settings (shipping-settings)", () => {
    it("tenant isolation: seller A cannot read or update seller B's shipping settings", async () => {
      const a = await signupLoginAndCreateStore("idor-store-settings-a@example.com", "idor-store-settings-a-store");
      const b = await signupLoginAndCreateStore("idor-store-settings-b@example.com", "idor-store-settings-b-store");
      const before = await superuser.storeShippingSettings.findUniqueOrThrow({ where: { storeId: b.storeId } });

      const crossGet = await request(app.getHttpServer())
        .get(`/stores/${b.storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${a.token}`);
      expect(crossGet.status).toBe(404);

      const crossPatch = await request(app.getHttpServer())
        .patch(`/stores/${b.storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ flatRate: 999999 });
      expect(crossPatch.status).toBe(404);

      const after = await superuser.storeShippingSettings.findUniqueOrThrow({ where: { storeId: b.storeId } });
      expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    });
  });

  // ===== 6. Staff ==========================================================
  describe("6. Staff", () => {
    it("tenant isolation: seller A cannot see, update, or revoke seller B's staff account", async () => {
      const a = await signupLoginAndCreateStore("idor-staff-a@example.com", "idor-staff-a-store");
      const b = await signupLoginAndCreateStore("idor-staff-b@example.com", "idor-staff-b-store");
      await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);
      const staffB = await createStaff(b.token, "idor-staff-b-hire@example.com", [scopeWrite("orders")]);

      const crossDevices = await request(app.getHttpServer())
        .get(`/sellers/me/staff-accounts/${staffB.staffAccountId}/devices`)
        .set("Authorization", `Bearer ${a.token}`);
      expect(crossDevices.status).toBe(404);

      const crossUpdate = await request(app.getHttpServer())
        .patch(`/sellers/me/staff-accounts/${staffB.staffAccountId}`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ deviceRestrictionEnabled: false });
      expect(crossUpdate.status).toBe(404);

      const crossRevoke = await request(app.getHttpServer())
        .delete(`/sellers/me/staff-accounts/${staffB.staffAccountId}`)
        .set("Authorization", `Bearer ${a.token}`);
      expect(crossRevoke.status).toBe(404);

      const unchanged = await superuser.staffAccount.findUniqueOrThrow({ where: { id: staffB.staffAccountId } });
      expect(unchanged.status).toBe("active");
    });
  });

  // ===== 7. Wallet =========================================================
  describe("7. Wallet", () => {
    it.todo(
      "Cross-tenant: already fully covered by module20-wallet-supplier-portal.e2e-spec.ts's " +
        "'Cross-tenant wallet isolation (P1.3 IDOR sweep)' describe block (~line 618), which checks " +
        "balance/transactions/topup-requests for both seller and supplier wallets. SellerWalletController/" +
        "SupplierWalletController take no foreign-seller-referencing route or body param at all - every route " +
        "resolves its owner only via @CurrentSellerId()/@CurrentSupplierId() off the caller's own JWT - so there " +
        "is no additional IDOR surface (no :id to redirect at another tenant) left to probe here.",
    );
  });

  // ===== 8. Domains ========================================================
  describe("8. Domains", () => {
    it("tenant isolation: seller A cannot list, verify, or remove a domain attached to seller B's store", async () => {
      const a = await signupLoginAndCreateStore("idor-domains-a@example.com", "idor-domains-a-store");
      const b = await signupLoginAndCreateStore("idor-domains-b@example.com", "idor-domains-b-store");
      // Seller-scoped, not global: PRECEDENCE (settings.types.ts) is
      // ["seller", "store", "supplier", "plan", "category", "global"] - a
      // fresh test seller lands on the starter_free plan (§5.73/FR-73.3),
      // which already has its own plan-scoped override of this key set to
      // false, outranking a merely-global one.
      await app.get(SettingsService).setValue("domains.custom_domain_enabled", "seller", b.sellerId, true, ADMIN_ID);

      const attach = await request(app.getHttpServer())
        .post(`/stores/${b.storeId}/domains`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ domainName: `b-owned-${Date.now()}.example.com` });
      expect(attach.status).toBe(201);
      const domainId = attach.body.id as string;

      const crossList = await request(app.getHttpServer())
        .get(`/stores/${b.storeId}/domains`)
        .set("Authorization", `Bearer ${a.token}`);
      expect(crossList.status).toBe(404);

      const crossVerify = await request(app.getHttpServer())
        .post(`/stores/${b.storeId}/domains/${domainId}/verify`)
        .set("Authorization", `Bearer ${a.token}`);
      expect(crossVerify.status).toBe(404);

      const crossRemove = await request(app.getHttpServer())
        .delete(`/stores/${b.storeId}/domains/${domainId}`)
        .set("Authorization", `Bearer ${a.token}`);
      expect(crossRemove.status).toBe(404);

      const unchanged = await superuser.domain.findUniqueOrThrow({ where: { id: domainId } });
      expect(unchanged.storeId).toBe(b.storeId);
    });
  });

  // ===== 9. All admin routes ==============================================
  describe("9. All admin routes", () => {
    // Not a cross-tenant test - admin authority is inherently cross-tenant by
    // design. Instead: a denial sweep across a representative sample of
    // admin routes from 6 different controllers, using a plain seller's own
    // Bearer token. Confirmed by reading AdminAuthGuard directly (apps/api/
    // src/common/guards/admin-auth.guard.ts): a validly-signed non-admin JWT
    // passes the underlying Passport "jwt" strategy fine, then fails the
    // guard's own `if (!request.user?.adminUserId) throw new
    // ForbiddenException(...)` check - ForbiddenException is HTTP 403, NOT
    // 401. (HttpExceptionFilter uses exception.getStatus() directly with no
    // remapping - verified too, so nothing downstream changes that status.)
    it("AdminAuthGuard rejects a plain seller's own Bearer token with 403 on every sampled admin route across 6 controllers", async () => {
      const { token } = await signupLoginAndCreateStore("idor-admin-sweep@example.com", "idor-admin-sweep-store");

      const r1 = await request(app.getHttpServer()).get("/admin/audit-logs").set("Authorization", `Bearer ${token}`);
      expect({ route: "GET /admin/audit-logs", status: r1.status }).toEqual({ route: "GET /admin/audit-logs", status: 403 });

      const r2 = await request(app.getHttpServer()).get("/admin/wallet-topups").set("Authorization", `Bearer ${token}`);
      expect({ route: "GET /admin/wallet-topups", status: r2.status }).toEqual({ route: "GET /admin/wallet-topups", status: 403 });

      const r3 = await request(app.getHttpServer()).get("/admin/sellers").set("Authorization", `Bearer ${token}`);
      expect({ route: "GET /admin/sellers", status: r3.status }).toEqual({ route: "GET /admin/sellers", status: 403 });

      const r4 = await request(app.getHttpServer())
        .post(`/admin/sellers/${FAKE_ID}/lifecycle`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "suspended", reason: "idor sweep probe" });
      expect({ route: "POST /admin/sellers/:id/lifecycle", status: r4.status }).toEqual({
        route: "POST /admin/sellers/:id/lifecycle",
        status: 403,
      });

      const r5 = await request(app.getHttpServer())
        .get(`/admin/sellers/${FAKE_ID}/staff-accounts`)
        .set("Authorization", `Bearer ${token}`);
      expect({ route: "GET /admin/sellers/:id/staff-accounts", status: r5.status }).toEqual({
        route: "GET /admin/sellers/:id/staff-accounts",
        status: 403,
      });

      const r6 = await request(app.getHttpServer())
        .post(`/admin/sellers/${FAKE_ID}/staff-accounts/${FAKE_ID}/suspend`)
        .set("Authorization", `Bearer ${token}`)
        .send({ until: new Date(Date.now() + 60_000).toISOString(), reason: "idor sweep probe" });
      expect({ route: "POST /admin/sellers/:id/staff-accounts/:id/suspend", status: r6.status }).toEqual({
        route: "POST /admin/sellers/:id/staff-accounts/:id/suspend",
        status: 403,
      });

      const r7 = await request(app.getHttpServer())
        .get(`/admin/sellers/${FAKE_ID}/overview`)
        .set("Authorization", `Bearer ${token}`);
      expect({ route: "GET /admin/sellers/:id/overview", status: r7.status }).toEqual({
        route: "GET /admin/sellers/:id/overview",
        status: 403,
      });

      const r8 = await request(app.getHttpServer()).get("/admin/settings/definitions").set("Authorization", `Bearer ${token}`);
      expect({ route: "GET /admin/settings/definitions", status: r8.status }).toEqual({
        route: "GET /admin/settings/definitions",
        status: 403,
      });

      const r9 = await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${token}`)
        .send({ key: "staff.max_accounts", scopeType: "global", value: 1 });
      expect({ route: "PUT /admin/settings/values", status: r9.status }).toEqual({ route: "PUT /admin/settings/values", status: 403 });
    });
  });

  // ===== Staff-permission limits - new coverage beyond module35 ==========
  describe("Staff-permission limits - groups without existing coverage", () => {
    it.todo(
      "Customers: already fully covered by module35-staff-accounts.e2e-spec.ts's 'customers scope now actually " +
        "gates the customers list/detail' test (~line 543) - none/read-only/write customers-scope staff are all " +
        "exercised there against this exact controller.",
    );

    it.todo(
      "Products/stock: already fully covered by module35-staff-accounts.e2e-spec.ts's 'catalog scope now " +
        "actually gates products, variants, and inventory' test (~line 469) - none/read-only/write catalog-scope " +
        "staff are all exercised there against both products.controller.ts and inventory.controller.ts.",
    );

    /**
     * GAP found during this sweep, then fixed in the same pass (D116 item
     * 3): ShippingSettingsController/TaxSettingsController/StoresController/
     * DomainsController (all read directly) applied neither StaffScopeGuard/
     * @RequireStaffScope (unlike orders/catalog/discounts/customers/theme-
     * settings) nor @BlockStaffSessions() (unlike payment-instructions/
     * staff-accounts/wallet, explicitly owner-only) - no fallback gate
     * caught it either, since StaffScopeGuard is never registered globally.
     * A staff JWT carries `sellerId` set to the OWNER's seller id
     * (StaffAuthService.signAccessToken()), so @CurrentSellerId() resolved
     * it exactly as it would for the owner. All four now get
     * @BlockStaffSessions() (no existing StaffScope value cleanly maps to
     * "store settings"/"domains", so owner-only is the safe default rather
     * than inventing a new scope's name/granularity unilaterally). These
     * tests now assert the FIXED behavior - a staff account, regardless of
     * scope, is blocked from shipping-settings exactly like payment-
     * instructions already is.
     */
    it("shipping-settings is owner-only - a staff account, regardless of scope, is blocked exactly like payment-instructions already is", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("idor-staffgap-shipping@example.com", "idor-staffgap-shipping-store");
      await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);
      const staff = await createStaff(token, "idor-staffgap-shipping-hire@example.com", [scopeWrite("design")]);

      const get = await request(app.getHttpServer())
        .get(`/stores/${storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${staff.staffToken}`);
      expect(get.status).toBe(403);

      const patch = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${staff.staffToken}`)
        .send({ flatRate: 777 });
      expect(patch.status).toBe(403);
    });

    /** Same finding/fix as shipping-settings immediately above - see that test's doc comment for the full analysis. */
    it("domains is owner-only - a staff account, regardless of scope, is blocked exactly like payment-instructions already is", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreateStore("idor-staffgap-domains@example.com", "idor-staffgap-domains-store");
      await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);
      // Seller-scoped, not global - see the cross-tenant domains test's own comment (outranks the starter_free plan's own override of this key).
      await app.get(SettingsService).setValue("domains.custom_domain_enabled", "seller", sellerId, true, ADMIN_ID);
      const staff = await createStaff(token, "idor-staffgap-domains-hire@example.com", [scopeWrite("design")]);

      const list = await request(app.getHttpServer())
        .get(`/stores/${storeId}/domains`)
        .set("Authorization", `Bearer ${staff.staffToken}`);
      expect(list.status).toBe(403);

      const attach = await request(app.getHttpServer())
        .post(`/stores/${storeId}/domains`)
        .set("Authorization", `Bearer ${staff.staffToken}`)
        .send({ domainName: `staff-attached-${Date.now()}.example.com` });
      expect(attach.status).toBe(403);
    });
  });
});
