import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

const BUILT_IN_TEMPLATES = ["Editorial", "Studio", "Market", "Atelier", "Start from blank"];

const shippingAddress = {
  fullName: "Ayesha Khan",
  line1: "House 12, Street 3",
  city: "Lahore",
  country: "PK",
  phone: "03001234567",
};

/**
 * Templates module (v0.31 design phase) - THE ISOLATION RULE's runtime
 * proof: template/customization choice affects PRESENTATION ONLY. This
 * suite runs the exact same money path (mixed cart, discount, tax, mark-as-
 * paid) once per built-in template (all 4 + "Start from blank"), then
 * asserts every functional output - order totals, ledger commission,
 * wallet balance delta, P&L figures, and the confirmed/verification
 * outcome - is byte-identical across all five runs. Only the rendered
 * chrome (proven separately by the section-registry unit test below)
 * differs; nothing about checkout, payments, commission, or the money
 * path itself may ever depend on which template is active.
 *
 * See scripts/check-template-isolation.js for the complementary static
 * check (no template file may even import the functional code this test
 * proves behaves identically).
 */
describe("Template isolation - THE ISOLATION RULE (e2e)", () => {
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

  async function fullyVerifiedAdminToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash("admin-password", 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: "admin-password" });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken;
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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId, hostname: `${slug}.uzeyn.com` };
  }

  async function signupLoginSupplier(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Supplier ${email}`, role: "supplier" });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    return login.body.accessToken as string;
  }

  async function createSelfProduct(token: string, storeId: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Self-Fulfilled Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/products/${product.body.id}/variants/${variant.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ baseCost: 200 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function createSupplierProduct(sellerToken: string, storeId: string, storeSlug: string) {
    const supplierEmail = `supplier-${Date.now()}-${Math.random()}@example.com`;
    const supplierToken = await signupLoginSupplier(supplierEmail);
    const supplierUser = await superuser.user.findUniqueOrThrow({ where: { email: supplierEmail }, include: { supplier: true } });
    const listing = await superuser.supplierListing.create({
      data: {
        supplierId: supplierUser.supplier!.id,
        adapterType: "printify",
        externalProductId: `ext-${Date.now()}-${Math.random()}`,
        title: "Supplier Mug",
        price: 300,
        shippingCost: 50,
        stockQuantity: 999999,
        estimatedDeliveryMinDays: 7,
        estimatedDeliveryMaxDays: 14,
        supportedCountries: ["PK"],
        rawPayload: {},
      },
    });
    const link = await request(app.getHttpServer())
      .post("/supplier/store-links")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSlug });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/supplier-links/${link.body.id}/approve`)
      .set("Authorization", `Bearer ${sellerToken}`);
    const submit = await request(app.getHttpServer())
      .post("/supplier/listings/submit-review")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSupplierLinkId: link.body.id, supplierListingId: listing.id });
    const approve = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`)
      .set("Authorization", `Bearer ${sellerToken}`);
    const variant = await superuser.productVariant.findFirstOrThrow({ where: { productId: approve.body.product.id } });
    await superuser.productVariant.update({ where: { id: variant.id }, data: { baseCost: 150 } });
    return { productId: approve.body.product.id as string, variantId: variant.id as string };
  }

  /**
   * The full money path, once, against whichever template is active on the
   * store. Returns every value that must be identical no matter the
   * template - never anything template/theme-specific itself.
   */
  async function runFullMoneyPath(templateName: string, emailSlug: string) {
    const { token, storeId, hostname } = await signupLoginAndCreateStore(`tmpl-${emailSlug}@example.com`, `tmpl-${emailSlug}-store`);

    const themes = await request(app.getHttpServer()).get("/themes").set("Authorization", `Bearer ${token}`);
    const theme = themes.body.find((t: { name: string }) => t.name === templateName);
    if (!theme) throw new Error(`Seeded theme "${templateName}" not found - themes.seed.ts drifted from this test.`);
    const themeUpdate = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ themeId: theme.id });
    if (themeUpdate.status !== 200) {
      throw new Error(`Could not select template "${templateName}": ${themeUpdate.status} ${JSON.stringify(themeUpdate.body)}`);
    }

    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/shipping-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ flatRate: 80, freeShippingThreshold: null });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/tax-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ taxRate: 10, taxInclusive: false });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/discount-codes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "SAVE100", type: "fixed_amount", value: 100 });

    const self = await createSelfProduct(token, storeId, 500);
    const supplier = await createSupplierProduct(token, storeId, `tmpl-${emailSlug}-store`);

    const balanceBefore = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({
        hostname,
        buyerEmail: "buyer@example.com",
        items: [
          { productId: self.productId, variantId: self.variantId, quantity: 2 },
          { productId: supplier.productId, variantId: supplier.variantId, quantity: 1 },
        ],
      });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress, discountCode: "SAVE100" });
    if (checkout.status !== 201) {
      throw new Error(`Checkout failed for template "${templateName}": ${checkout.status} ${JSON.stringify(checkout.body)}`);
    }
    const orderId = checkout.body.id as string;

    await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);

    const order = await request(app.getHttpServer()).get(`/stores/${storeId}/orders/${orderId}`).set("Authorization", `Bearer ${token}`);
    const ledger = await superuser.ledgerEntry.aggregate({
      where: { orderId, type: { in: ["commission_accrued", "commission_waived"] } },
      _sum: { amount: true },
    });
    const balanceAfter = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
    const profit = await request(app.getHttpServer()).get(`/stores/${storeId}/pnl/orders/${orderId}`).set("Authorization", `Bearer ${token}`);
    const publicStore = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);

    return {
      status: order.body.status,
      discountAmount: checkout.body.discountAmount,
      shippingAmount: checkout.body.shippingAmount,
      taxAmount: checkout.body.taxAmount,
      totalAmount: checkout.body.totalAmount,
      commission: Number(ledger._sum.amount ?? 0),
      walletBalanceDelta: Number(balanceAfter.body.balance) - Number(balanceBefore.body.balance),
      profitRevenue: profit.body.revenue,
      profitCogs: profit.body.cogs,
      profitNetProfit: profit.body.netProfit,
      poweredByVisible: publicStore.body.poweredByVisible,
    };
  }

  it("produces byte-identical order totals, commission, wallet delta, P&L, and confirmation outcome across every built-in template and the blank-start option", async () => {
    const adminToken = await fullyVerifiedAdminToken("tmpl-admin@example.com");
    // Studio/Market are premium-tier templates - enable the gate globally so
    // every one of the 5 runs below can actually select its assigned
    // template (this test is about isolation, not re-proving Module 18's
    // own premium-tier-gate test, which already covers that gate itself).
    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "theme.premium_tier_enabled", scopeType: "global", value: true });

    const results: Record<string, Awaited<ReturnType<typeof runFullMoneyPath>>> = {};
    for (const templateName of BUILT_IN_TEMPLATES) {
      const slug = templateName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      results[templateName] = await runFullMoneyPath(templateName, slug);
    }

    const [firstTemplate, ...restTemplates] = BUILT_IN_TEMPLATES;
    const baseline = results[firstTemplate];

    // Sanity-check the baseline itself is a real, non-degenerate result
    // before using it as the thing every other template must match.
    expect(baseline.status).toBe("confirmed");
    expect(baseline.discountAmount).toBe("100");
    expect(baseline.shippingAmount).toBe("130");
    expect(baseline.taxAmount).toBe("120");
    expect(baseline.totalAmount).toBe("1450");
    expect(baseline.profitCogs).toBe(550);
    // WalletService.getBalance() derives balance from LedgerEntry rows
    // (Module 20 "extends Module 11's ledger") - the commission_accrued
    // entry markAsPaid() just wrote is a real debit, not a no-op.
    // toBeCloseTo, not toBe: at 0% commission (Module 74), -baseline.commission
    // is JS -0, which Object.is()-based toBe() treats as distinct from 0.
    expect(baseline.walletBalanceDelta).toBeCloseTo(-baseline.commission, 2);
    expect(baseline.poweredByVisible).toBe(true);

    for (const templateName of restTemplates) {
      expect(results[templateName]).toEqual(baseline);
    }
  });

  /**
   * D-Studio v1 (founder-requested re-verification, close-out) - the
   * isolation rule re-proven against the specific new surface D-Studio
   * introduces: a RISE-tier seller's rich section/variant/per-element-
   * animation configuration (settings.sections), not just a themeId
   * choice. All 17 new section types (templates/dstudio-sections/) are
   * pure-presentational, read-only-prop components structurally unable to
   * import cart/checkout/order code (enforced separately by
   * check-template-isolation.js's static scan, which already covers this
   * directory since it lives under templates/) - this test is the runtime
   * proof that configuring them doesn't touch the money path either.
   */
  it("D-Studio v1: a RISE-tier seller's rich section/variant/animation configuration produces the exact same money-path result as the plain baseline", async () => {
    const richResult = await (async () => {
      const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("tmpl-dstudio-rich@example.com", "tmpl-dstudio-rich-store");
      const risePlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });
      await superuser.subscription.update({ where: { sellerId }, data: { planId: risePlan.id } });

      const themes = await request(app.getHttpServer()).get("/themes").set("Authorization", `Bearer ${token}`);
      const theme = themes.body.find((t: { name: string }) => t.name === "Editorial");

      // A deliberately rich D-Studio configuration: new section types
      // (team/before_after/shape_divider/comparison_table - none of which
      // existed before this module), non-default layout variants, and
      // per-element RISE-tier-only animation presets on several sections.
      const themeUpdate = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          themeId: theme.id,
          settings: {
            sections: [
              { id: "hero", visible: true, variant: 2, elementAnimations: { heading: "ken-burns", image: "glass-reveal" } },
              { id: "featured_products", visible: true, variant: 1, elementAnimations: { image: "stagger-reveal" } },
              { id: "team", visible: true, variant: 1, elementAnimations: { heading: "text-split" } },
              { id: "before_after", visible: true, variant: 1 },
              { id: "shape_divider", visible: true, variant: 2 },
              { id: "comparison_table", visible: true, variant: 1 },
              { id: "sticky_cta", visible: true, elementAnimations: { button: "magnetic" } },
            ],
          },
        });
      if (themeUpdate.status !== 200) {
        throw new Error(`Rich D-Studio config write failed: ${themeUpdate.status} ${JSON.stringify(themeUpdate.body)}`);
      }

      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ flatRate: 80, freeShippingThreshold: null });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/tax-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ taxRate: 10, taxInclusive: false });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/discount-codes`)
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "SAVE100", type: "fixed_amount", value: 100 });

      const self = await createSelfProduct(token, storeId, 500);
      const supplier = await createSupplierProduct(token, storeId, "tmpl-dstudio-rich-store");
      const balanceBefore = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);

      const cart = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({
          hostname,
          buyerEmail: "buyer@example.com",
          items: [
            { productId: self.productId, variantId: self.variantId, quantity: 2 },
            { productId: supplier.productId, variantId: supplier.variantId, quantity: 1 },
          ],
        });
      const checkout = await request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress, discountCode: "SAVE100" });
      if (checkout.status !== 201) {
        throw new Error(`Checkout failed for D-Studio rich config: ${checkout.status} ${JSON.stringify(checkout.body)}`);
      }
      const orderId = checkout.body.id as string;
      await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);

      const order = await request(app.getHttpServer()).get(`/stores/${storeId}/orders/${orderId}`).set("Authorization", `Bearer ${token}`);
      const ledger = await superuser.ledgerEntry.aggregate({
        where: { orderId, type: { in: ["commission_accrued", "commission_waived"] } },
        _sum: { amount: true },
      });
      const balanceAfter = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
      const profit = await request(app.getHttpServer()).get(`/stores/${storeId}/pnl/orders/${orderId}`).set("Authorization", `Bearer ${token}`);
      const publicStore = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);

      // Confirms the rich config actually persisted (proves this isn't a
      // no-op write) while every financial figure below still matches the
      // plain-Editorial baseline exactly - the API layer has no page-
      // rendering route to check against; the frontend rendering itself
      // was independently verified via a real Playwright click-through.
      const savedSettings = await request(app.getHttpServer())
        .get(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`);
      return {
        status: order.body.status,
        discountAmount: checkout.body.discountAmount,
        shippingAmount: checkout.body.shippingAmount,
        taxAmount: checkout.body.taxAmount,
        totalAmount: checkout.body.totalAmount,
        commission: Number(ledger._sum.amount ?? 0),
        walletBalanceDelta: Number(balanceAfter.body.balance) - Number(balanceBefore.body.balance),
        profitRevenue: profit.body.revenue,
        profitCogs: profit.body.cogs,
        profitNetProfit: profit.body.netProfit,
        poweredByVisible: publicStore.body.poweredByVisible,
        savedSectionCount: (savedSettings.body.settings?.sections ?? []).length,
      };
    })();

    expect(richResult.status).toBe("confirmed");
    expect(richResult.discountAmount).toBe("100");
    expect(richResult.shippingAmount).toBe("130");
    expect(richResult.taxAmount).toBe("120");
    expect(richResult.totalAmount).toBe("1450");
    expect(richResult.profitCogs).toBe(550);
    expect(richResult.walletBalanceDelta).toBeCloseTo(-richResult.commission, 2);
    expect(richResult.poweredByVisible).toBe(true);
    expect(richResult.savedSectionCount).toBe(7);
  });
});
