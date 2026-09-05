import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * FR-66.4 (Module 84) - shipping cost calculator on product/cart pages,
 * reusing the exact flat-rate/free-threshold math checkout itself computes
 * (order-totals.util.ts's computeOrderTotals, via CartService.quoteShipping()).
 */
describe("Shipping cost calculator (e2e) - FR-66.4 (Module 84)", () => {
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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    // New-seller moderation probation (Module 12, FR-29.3) would otherwise
    // leave a self-fulfilled product's moderationStatus "pending" - not in
    // PUBLIC_MODERATION_STATUSES, so OrderPricingService.priceItems() (and
    // hence the shipping-quote endpoint) would 404 it. Same fix as the
    // P1.1/milestone-celebrations helpers.
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function createSelfProduct(token: string, storeId: string, title: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title, status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function setShippingSettings(storeId: string, flatRate: number, freeShippingThreshold: number | null) {
    await superuser.storeShippingSettings.update({ where: { storeId }, data: { flatRate, freeShippingThreshold } });
  }

  it("charges the flat rate for a self-fulfilled item below the free-shipping threshold", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("shipquote-flat@example.com", "shipquote-flat-store");
    await setShippingSettings(storeId, 8, 100);
    const widget = await createSelfProduct(token, storeId, "Widget", 30);

    const res = await request(app.getHttpServer())
      .post("/storefront/cart/shipping-quote")
      .send({ hostname, items: [{ productId: widget.productId, variantId: widget.variantId, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ subtotal: 30, shippingAmount: 8, freeShippingThreshold: 100, amountUntilFreeShipping: 70 });
  });

  it("waives the flat rate once the subtotal reaches the free-shipping threshold", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("shipquote-free@example.com", "shipquote-free-store");
    await setShippingSettings(storeId, 8, 100);
    const widget = await createSelfProduct(token, storeId, "Widget", 50);

    const res = await request(app.getHttpServer())
      .post("/storefront/cart/shipping-quote")
      .send({ hostname, items: [{ productId: widget.productId, variantId: widget.variantId, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ subtotal: 100, shippingAmount: 0, freeShippingThreshold: 100, amountUntilFreeShipping: 0 });
  });

  it("reports null free-shipping fields when the store has no threshold configured", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("shipquote-nothresh@example.com", "shipquote-nothresh-store");
    await setShippingSettings(storeId, 5, null);
    const widget = await createSelfProduct(token, storeId, "Widget", 20);

    const res = await request(app.getHttpServer())
      .post("/storefront/cart/shipping-quote")
      .send({ hostname, items: [{ productId: widget.productId, variantId: widget.variantId, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ subtotal: 20, shippingAmount: 5, freeShippingThreshold: null, amountUntilFreeShipping: null });
  });

  it("charges a supplier-fulfilled item's own per-unit shipping cost, unaffected by the store's flat rate", async () => {
    const { token: sellerToken, storeId, hostname } = await signupLoginAndCreateStore("shipquote-supplier@example.com", "shipquote-supplier-store");
    await setShippingSettings(storeId, 8, 1000);

    const supplierEmail = `shipquote-supplier-account-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email: supplierEmail, password: PASSWORD, businessName: "Supplier", role: "supplier" });
    const supplierLogin = await request(app.getHttpServer()).post("/auth/login").send({ email: supplierEmail, password: PASSWORD });
    const supplierToken = supplierLogin.body.accessToken as string;

    const supplierUser = await superuser.user.findUniqueOrThrow({ where: { email: supplierEmail }, include: { supplier: true } });
    const listing = await superuser.supplierListing.create({
      data: {
        supplierId: supplierUser.supplier!.id,
        adapterType: "printify",
        externalProductId: `ext-${Date.now()}`,
        title: "Supplier Widget",
        price: 40,
        shippingCost: 12,
        estimatedDeliveryMinDays: 7,
        estimatedDeliveryMaxDays: 14,
        supportedCountries: ["PK"],
        rawPayload: {},
      },
    });

    const linkRes = await request(app.getHttpServer())
      .post("/supplier/store-links")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSlug: "shipquote-supplier-store" });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/supplier-links/${linkRes.body.id}/approve`)
      .set("Authorization", `Bearer ${sellerToken}`);
    const submit = await request(app.getHttpServer())
      .post("/supplier/listings/submit-review")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSupplierLinkId: linkRes.body.id, supplierListingId: listing.id });
    const approve = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`)
      .set("Authorization", `Bearer ${sellerToken}`);
    const productId = approve.body.product.id as string;
    const variant = await superuser.productVariant.findFirstOrThrow({ where: { productId } });

    const res = await request(app.getHttpServer())
      .post("/storefront/cart/shipping-quote")
      .send({ hostname, items: [{ productId, variantId: variant.id, quantity: 2 }] });

    expect(res.status).toBe(201);
    // subtotal = 40 * 2 = 80; shipping = supplier's own 12/unit * 2 = 24
    // (the store's flat rate/free threshold never apply to a supplier item).
    expect(res.body).toMatchObject({ subtotal: 80, shippingAmount: 24 });
  });

  it("rejects an unknown hostname", async () => {
    const res = await request(app.getHttpServer())
      .post("/storefront/cart/shipping-quote")
      .send({ hostname: "no-such-store.uzeyn.com", items: [{ productId: "00000000-0000-0000-0000-000000000000", variantId: "00000000-0000-0000-0000-000000000000", quantity: 1 }] });
    expect(res.status).toBe(404);
  });
});
