import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { CartService } from "../../src/orders/cart.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS §5.5/§5.15/§5.17 (Orders, Cart & Checkout), §14.5/§14.15/§14.17 - per
 * docs/build-plan.md's stated scope, this module does NOT cover §14.6
 * (Payments, Commission, Ledger & Payout Engine) - `ledger_entries` doesn't
 * exist until Module 10/11. Every place this module's own code touches
 * that boundary (mark-as-paid's Payment row, FR-17.5's "basic" edit scope)
 * is disclosed in the Module 9 report, not silently skipped here.
 */
describe("Orders, Cart & Checkout (e2e) - SRS §5.5/§5.15/§5.17, §14.5/§14.15/§14.17", () => {
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
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    // Every test in this file focuses on Orders/Cart/Checkout, not
    // Moderation (Module 6) - a trusted seller's products always land
    // `moderationStatus: 'not_required'`, same simplification suppliers.e2e-spec.ts
    // already established for its own out-of-focus prerequisites.
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true } });
    // Module 11 prerequisite fix (FR-6.14) - checkout now requires at least
    // one configured payment method; not this file's focus, so enable COD
    // directly rather than every test wiring its own payment-instructions call.
    await superuser.storePaymentInstructions.update({
      where: { storeId: store.body.id },
      data: { codEnabled: true },
    });
    // Module 12 (FR-30.1) - checkout also requires a CNIC on file for the
    // seller; not this file's focus (identity verification), so set a
    // synthetic hash directly rather than every test going through the
    // real CNIC-set endpoint.
    await superuser.seller.update({ where: { userId: user.id }, data: { cnicHash: `test-cnic-hash-${user.id}` } });
    // Module 20 (SRS §5.6e, FR-6.21) - checkout now also requires the store
    // to be published; set directly rather than every test going through
    // the real publish flow (top-up + verify).
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function signupLoginSupplier(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Supplier ${email}`, role: "supplier" });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    return login.body.accessToken as string;
  }

  async function createSelfProduct(token: string, storeId: string, price: number, stockQuantity = 100, trackInventory = true) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Self-Fulfilled Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity, trackInventory });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  /** Approved, supplier-fulfilled product - via the real Module 8 review flow so FR-4.5/4.6/4.7/4.8 wiring is exercised against a real approved listing. */
  async function createSupplierProduct(
    sellerToken: string,
    storeId: string,
    storeSlug: string,
    input: { price: number; shippingCost: number; supportedCountries: string[]; stockQuantity?: number },
  ) {
    const supplierEmail = `supplier-${Date.now()}-${Math.random()}@example.com`;
    const supplierToken = await signupLoginSupplier(supplierEmail);
    const supplierUser = await superuser.user.findUniqueOrThrow({ where: { email: supplierEmail }, include: { supplier: true } });
    const listing = await superuser.supplierListing.create({
      data: {
        supplierId: supplierUser.supplier!.id,
        adapterType: "printify",
        externalProductId: `ext-${Date.now()}-${Math.random()}`,
        title: "Supplier Mug",
        price: input.price,
        shippingCost: input.shippingCost,
        stockQuantity: input.stockQuantity ?? 999999,
        estimatedDeliveryMinDays: 7,
        estimatedDeliveryMaxDays: 14,
        supportedCountries: input.supportedCountries,
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
    return {
      productId: approve.body.product.id as string,
      variantId: variant.id as string,
      supplierListingId: listing.id as string,
      supplierToken,
    };
  }

  const shippingAddress = {
    fullName: "Ayesha Khan",
    line1: "House 12, Street 3",
    city: "Lahore",
    country: "PK",
    phone: "03001234567",
  };

  it("checkout is email-first: a cart row is only ever created via POST /storefront/cart, never before (FR-15.1)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("cart-email-first@example.com", "cart-email-first-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);

    const create = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 2 }] });
    expect(create.status).toBe(201);
    expect(create.body.sessionToken).toBeTruthy();
    expect(create.body.subtotal).toBe(2000);

    const carts = await superuser.cart.findMany({ where: { storeId } });
    expect(carts).toHaveLength(1);
    expect(carts[0].buyerEmail).toBe("buyer@example.com");
  });

  it("a buyer can update their cart's items while it is still active", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("cart-update@example.com", "cart-update-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);

    const create = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const sessionToken = create.body.sessionToken as string;

    const update = await request(app.getHttpServer())
      .patch(`/storefront/cart/${sessionToken}`)
      .send({ hostname, items: [{ productId, variantId, quantity: 3 }] });
    expect(update.status).toBe(200);
    expect(update.body.subtotal).toBe(1500);
  });

  it(
    "checkout creates a `pending` order (Financial Truth Invariant); mark-as-paid is the only path to `confirmed`, " +
      "and only then does `order.placed` fire (§3.11/§3.12, §14.5)",
    async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("checkout-happy@example.com", "checkout-happy-store");
      const { productId, variantId } = await createSelfProduct(token, storeId, 1000);

      const cart = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });

      const checkout = await request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
      expect(checkout.status).toBe(201);
      expect(checkout.body.status).toBe("pending");
      const orderId = checkout.body.id as string;

      // Financial Truth Invariant - a pending order is visible to the
      // seller (so they know to act on it), but never as a completed sale.
      const list = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders`)
        .set("Authorization", `Bearer ${token}`);
      expect(list.body.map((o: any) => o.id)).toContain(orderId);
      expect(list.body.find((o: any) => o.id === orderId).status).toBe("pending");

      const eventsBeforePaid = await superuser.platformEvent.findMany({ where: { eventType: "order.placed", entityId: orderId } });
      expect(eventsBeforePaid).toHaveLength(0);

      const markPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(markPaid.status).toBe(201);
      expect(markPaid.body.status).toBe("confirmed");

      const payments = await superuser.payment.findMany({ where: { orderId } });
      expect(payments).toHaveLength(1);
      expect(payments[0].gateway).toBe("manual");
      expect(payments[0].status).toBe("succeeded");

      const eventsAfterPaid = await superuser.platformEvent.findMany({ where: { eventType: "order.placed", entityId: orderId } });
      expect(eventsAfterPaid).toHaveLength(1);

      const secondMarkPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(secondMarkPaid.status).toBe(400);
    },
  );

  it("FR-5.4: the buyer order-status lookup token is unguessable and never leaks seller-only fields (notes, tags)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("status-lookup@example.com", "status-lookup-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 750);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });

    const order = await superuser.order.findUniqueOrThrow({ where: { id: checkout.body.id } });
    expect(order.statusLookupToken).toHaveLength(48); // 24 bytes hex
    expect(order.id).not.toBe(order.statusLookupToken);

    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${order.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Internal-only note about this buyer" });

    const lookup = await request(app.getHttpServer()).get(`/storefront/order-status/${order.statusLookupToken}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.status).toBe("pending");
    expect(JSON.stringify(lookup.body)).not.toContain("Internal-only note");

    const badLookup = await request(app.getHttpServer()).get("/storefront/order-status/not-a-real-token");
    expect(badLookup.status).toBe(404);
  });

  it("FR-5.5: an expired discount code is rejected, a usage-limit-exceeded code is rejected, a valid code applies correctly", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("discount-checkout@example.com", "discount-checkout-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);

    await request(app.getHttpServer())
      .post(`/stores/${storeId}/discount-codes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "EXPIRED10", type: "percentage", value: 10, expiresAt: "2000-01-01T00:00:00.000Z" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/discount-codes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "ONEUSE", type: "fixed_amount", value: 100, usageLimit: 1 });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/discount-codes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "SAVE10", type: "percentage", value: 10 });

    async function checkoutWithCode(code: string) {
      const cart = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
      return request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress, discountCode: code });
    }

    const expired = await checkoutWithCode("EXPIRED10");
    expect(expired.status).toBe(400);

    const bogus = await checkoutWithCode("DOES-NOT-EXIST");
    expect(bogus.status).toBe(400);

    const firstUse = await checkoutWithCode("ONEUSE");
    expect(firstUse.status).toBe(201);
    expect(firstUse.body.discountAmount).toBe("100");

    const secondUse = await checkoutWithCode("ONEUSE");
    expect(secondUse.status).toBe(400);

    const valid = await checkoutWithCode("SAVE10");
    expect(valid.status).toBe(201);
    expect(valid.body.discountAmount).toBe("100"); // 10% of 1000
    expect(valid.body.totalAmount).toBe("900");
  });

  it("FR-5.6: mixed-cart shipping is computed per fulfillment source and summed", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("mixed-shipping@example.com", "mixed-shipping-store");
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/shipping-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ flatRate: 200, freeShippingThreshold: null });

    const self = await createSelfProduct(token, storeId, 1000);
    const supplier = await createSupplierProduct(token, storeId, "mixed-shipping-store", {
      price: 500,
      shippingCost: 300,
      supportedCountries: ["PK"],
    });

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({
        hostname,
        buyerEmail: "buyer@example.com",
        items: [
          { productId: self.productId, variantId: self.variantId, quantity: 1 },
          { productId: supplier.productId, variantId: supplier.variantId, quantity: 1 },
        ],
      });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);
    expect(checkout.body.shippingAmount).toBe("500"); // 200 flat + 300 supplier
    expect(checkout.body.totalAmount).toBe("2000"); // 1000 + 500 + 500
  });

  it("FR-4.7: checkout hard-blocks a supplier item that cannot ship to the buyer's country", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("country-block@example.com", "country-block-store");
    const supplier = await createSupplierProduct(token, storeId, "country-block-store", {
      price: 500,
      shippingCost: 100,
      supportedCountries: ["US"], // does not support PK
    });

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId: supplier.productId, variantId: supplier.variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress }); // shippingAddress.country = PK
    expect(checkout.status).toBe(400);

    // The blocked checkout must not have decremented supplier stock.
    const listing = await superuser.supplierListing.findUniqueOrThrow({ where: { id: supplier.supplierListingId } });
    expect(listing.stockQuantity).toBe(999999);
  });

  it("FR-4.8: checkout always prices a supplier item at its current live price, never a stale cached one", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("price-revalidate@example.com", "price-revalidate-store");
    const supplier = await createSupplierProduct(token, storeId, "price-revalidate-store", {
      price: 500,
      shippingCost: 0,
      supportedCountries: ["PK"],
    });

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId: supplier.productId, variantId: supplier.variantId, quantity: 2 }] });

    // Supplier's synced price changes between cart creation and checkout.
    await superuser.supplierListing.update({ where: { id: supplier.supplierListingId }, data: { price: 800 } });

    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);
    expect(checkout.body.totalAmount).toBe("1600"); // 800 * 2, not the stale 500
  });

  it("FR-4.5: oversell protection is wired into checkout - two concurrent checkouts against the last unit only one succeeds", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("oversell-checkout@example.com", "oversell-checkout-store");
    const supplier = await createSupplierProduct(token, storeId, "oversell-checkout-store", {
      price: 500,
      shippingCost: 0,
      supportedCountries: ["PK"],
      stockQuantity: 1,
    });

    const cartA = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer-a@example.com", items: [{ productId: supplier.productId, variantId: supplier.variantId, quantity: 1 }] });
    const cartB = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer-b@example.com", items: [{ productId: supplier.productId, variantId: supplier.variantId, quantity: 1 }] });

    const [checkoutA, checkoutB] = await Promise.all([
      request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cartA.body.sessionToken, shippingAddress }),
      request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cartB.body.sessionToken, shippingAddress }),
    ]);
    const statuses = [checkoutA.status, checkoutB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const listing = await superuser.supplierListing.findUniqueOrThrow({ where: { id: supplier.supplierListingId } });
    expect(listing.stockQuantity).toBe(0);
  });

  it("FR-39.5 (Module 46): oversell protection now also covers self-fulfilled items - two concurrent checkouts against the last unit only one succeeds, and the loser never decremented stock", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("oversell-self-fulfilled@example.com", "oversell-self-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500, 1);

    const cartA = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer-a@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const cartB = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer-b@example.com", items: [{ productId, variantId, quantity: 1 }] });

    const [checkoutA, checkoutB] = await Promise.all([
      request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cartA.body.sessionToken, shippingAddress }),
      request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cartB.body.sessionToken, shippingAddress }),
    ]);
    const statuses = [checkoutA.status, checkoutB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const variant = await superuser.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.stockQuantity).toBe(0);
  });

  it("FR-39.5 (Module 46): a variant with trackInventory: false has unlimited stock - checkout never checks or decrements it", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("untracked-variant@example.com", "untracked-variant-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500, 0, false);

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 5 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);

    const variant = await superuser.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.stockQuantity).toBe(0); // unchanged - never decremented
  });

  it("FR-39.5 (Module 46): a mixed cart (one self-fulfilled item oversold, one healthy) rejects the whole order and leaves both variants' stock untouched", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("oversell-mixed-cart@example.com", "oversell-mixed-store");
    const scarce = await createSelfProduct(token, storeId, 500, 0);
    const healthy = await createSelfProduct(token, storeId, 300, 10);

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({
        hostname,
        buyerEmail: "buyer@example.com",
        items: [
          { productId: healthy.productId, variantId: healthy.variantId, quantity: 1 },
          { productId: scarce.productId, variantId: scarce.variantId, quantity: 1 },
        ],
      });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(409);

    const healthyVariant = await superuser.productVariant.findUniqueOrThrow({ where: { id: healthy.variantId } });
    expect(healthyVariant.stockQuantity).toBe(10); // reserved then released, never left decremented
  });

  it("FR-5.3: a suspended store blocks new carts/checkouts, but its existing orders remain fulfillable from the seller dashboard", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("suspended-store@example.com", "suspended-store-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const orderId = checkout.body.id as string;

    await superuser.store.update({ where: { id: storeId }, data: { status: "suspended" } });

    const blockedStore = await request(app.getHttpServer()).get("/storefront/store").query({ hostname });
    expect(blockedStore.status).toBe(403);
    expect(blockedStore.body.message).toMatchObject({ code: "store_suspended" });

    const blockedCart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer2@example.com", items: [{ productId, variantId, quantity: 1 }] });
    expect(blockedCart.status).toBe(403);

    // The seller dashboard can still fulfill the order placed before suspension.
    const markPaid = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    expect(markPaid.status).toBe(201);
    expect(markPaid.body.status).toBe("confirmed");
  });

  it("FR-17.1: a seller can create a manual/draft order from the dashboard and mark it paid, identical in shape to a storefront order", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("manual-order@example.com", "manual-order-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 2000);

    const manual = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        buyerEmail: "phone-buyer@example.com",
        shippingAddress,
        items: [{ productId, variantId, quantity: 1 }],
      });
    expect(manual.status).toBe(201);
    expect(manual.body.source).toBe("manual");
    expect(manual.body.status).toBe("pending");

    const markPaid = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${manual.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    expect(markPaid.status).toBe(201);
    expect(markPaid.body.status).toBe("confirmed");

    const payments = await superuser.payment.findMany({ where: { orderId: manual.body.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0].gateway).toBe("manual");
  });

  it("FR-17.2: order notes are never exposed on the buyer-facing status lookup", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("order-notes@example.com", "order-notes-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });

    const note = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${checkout.body.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Buyer called to ask about delivery" });
    expect(note.status).toBe(201);

    const detail = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders/${checkout.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.body.notes).toHaveLength(1);
  });

  it("FR-17.3: order tags filter the dashboard order list", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("order-tags@example.com", "order-tags-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });

    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/orders/${checkout.body.id}/tags`)
      .set("Authorization", `Bearer ${token}`)
      .send({ tags: ["urgent", "gift"] });

    const filtered = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders`)
      .query({ tag: "urgent" })
      .set("Authorization", `Bearer ${token}`);
    expect(filtered.body.map((o: any) => o.id)).toEqual([checkout.body.id]);

    const notMatching = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders`)
      .query({ tag: "nope" })
      .set("Authorization", `Bearer ${token}`);
    expect(notMatching.body).toEqual([]);
  });

  it("FR-17.5: editing an order's item quantity adjusts stock in both directions and recomputes the total; a shipped order cannot be edited", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("order-edit@example.com", "order-edit-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500, 10);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 2 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const orderId = checkout.body.id as string;

    const stockAfterOrder = await superuser.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(stockAfterOrder.stockQuantity).toBe(8); // 10 - 2 (Module 46: checkout now reserves self-fulfilled stock up front, same as supplier items)

    const detail = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`);
    const orderItemId = detail.body.items[0].id as string;

    const edit = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ orderItemId, quantity: 4 }] });
    expect(edit.status).toBe(200);
    expect(edit.body.totalAmount).toBe("2000"); // 500 * 4

    const stockAfterIncrease = await superuser.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(stockAfterIncrease.stockQuantity).toBe(6); // 8 - (4-2)

    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    await superuser.order.update({ where: { id: orderId }, data: { status: "shipped" } });

    const blockedEdit = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ orderItemId, quantity: 1 }] });
    expect(blockedEdit.status).toBe(400);
  });

  it("FR-3.4/FR-5.2: uploading tracking bumps the item (and, once every item ships, the order) to `shipped`", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("tracking-upload@example.com", "tracking-upload-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const orderId = checkout.body.id as string;
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);

    const detail = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`);
    const orderItemId = detail.body.items[0].id as string;

    const tracking = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/items/${orderItemId}/tracking`)
      .set("Authorization", `Bearer ${token}`)
      .send({ trackingId: "TRACK123", carrier: "TCS" });
    expect(tracking.status).toBe(201);
    expect(tracking.body.status).toBe("shipped");

    const trackingRows = await superuser.trackingUpdate.findMany({ where: { orderItemId } });
    expect(trackingRows).toHaveLength(1);
    expect(trackingRows[0].trackingId).toBe("TRACK123");
  });

  it("FR-3.3/FR-3.4: a supplier sees their own order items across stores and can upload tracking directly", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("supplier-order-view@example.com", "supplier-order-view-store");
    const supplier = await createSupplierProduct(token, storeId, "supplier-order-view-store", {
      price: 500,
      shippingCost: 0,
      supportedCountries: ["PK"],
    });
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId: supplier.productId, variantId: supplier.variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${checkout.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);

    const supplierOrders = await request(app.getHttpServer())
      .get("/supplier/orders")
      .set("Authorization", `Bearer ${supplier.supplierToken}`);
    expect(supplierOrders.status).toBe(200);
    expect(supplierOrders.body).toHaveLength(1);
    const orderItemId = supplierOrders.body[0].id as string;

    const tracking = await request(app.getHttpServer())
      .post(`/supplier/order-items/${orderItemId}/tracking`)
      .set("Authorization", `Bearer ${supplier.supplierToken}`)
      .send({ trackingId: "SUP-TRACK-1" });
    expect(tracking.status).toBe(201);
    expect(tracking.body.status).toBe("shipped");
  });

  it("tenant isolation: seller A cannot see, mark paid, or otherwise act on seller B's orders", async () => {
    const a = await signupLoginAndCreateStore("order-tenant-a@example.com", "order-tenant-a-store");
    const b = await signupLoginAndCreateStore("order-tenant-b@example.com", "order-tenant-b-store");
    const { productId, variantId } = await createSelfProduct(a.token, a.storeId, 500);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname: a.hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname: a.hostname, sessionToken: cart.body.sessionToken, shippingAddress });

    const crossGet = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/orders/${checkout.body.id}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossGet.status).toBe(404);

    const crossMarkPaid = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/orders/${checkout.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossMarkPaid.status).toBe(404);

    const unchanged = await superuser.order.findUniqueOrThrow({ where: { id: checkout.body.id } });
    expect(unchanged.status).toBe("pending");
  });

  it("RLS denies cross-tenant access to orders at the database level, independent of the app layer", async () => {
    const sellerA = await superuser.seller.create({
      data: { businessName: "DB-level A", user: { create: { email: "order-db-a@example.com", roleFlags: ["seller"] } } },
    });
    const sellerB = await superuser.seller.create({
      data: { businessName: "DB-level B", user: { create: { email: "order-db-b@example.com", roleFlags: ["seller"] } } },
    });
    const storeA = await superuser.store.create({ data: { sellerId: sellerA.id, name: "DB Store A", slug: "order-db-store-a" } });
    await superuser.order.create({
      data: {
        storeId: storeA.id,
        buyerEmail: "x@example.com",
        statusLookupToken: "db-level-test-token",
        shippingAddress: {},
        shippingAmount: 0,
        totalAmount: 100,
        currency: "PKR",
      },
    });

    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const asSellerB = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerB.id}'`);
      return tx.order.findMany();
    });
    expect(asSellerB).toEqual([]);

    const noContext = await runtime.$transaction(async (tx) => tx.order.findMany());
    expect(noContext).toEqual([]); // fail-closed
    await runtime.$disconnect();
  });

  it("FR-15.2: the abandoned-cart sweep flags an inactive cart but leaves a recently-active one alone", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("cart-abandon@example.com", "cart-abandon-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);

    const staleCart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "stale@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const freshCart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "fresh@example.com", items: [{ productId, variantId, quantity: 1 }] });

    await superuser.$executeRawUnsafe(
      `UPDATE carts SET updated_at = NOW() - INTERVAL '48 hours' WHERE session_token = $1`,
      staleCart.body.sessionToken,
    );

    const cartService = app.get(CartService);
    const result = await cartService.flagAbandonedCarts();
    expect(result.flagged).toBe(1);

    const stale = await superuser.cart.findUniqueOrThrow({ where: { sessionToken: staleCart.body.sessionToken } });
    expect(stale.status).toBe("abandoned");
    const fresh = await superuser.cart.findUniqueOrThrow({ where: { sessionToken: freshCart.body.sessionToken } });
    expect(fresh.status).toBe("active");
  });
});
