import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { ProductImportService } from "../../src/data-portability/product-import.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const PASSWORD = "correct-horse-battery";
const S3_TEST_PORT = 4569;
const BUCKET = "uzeyn-media-test";

/**
 * Module 31 (SRS §5.42, §14.42) - Automated Profit & Loss Engine. Reuses
 * Order/OrderItem/ProductVariant/LedgerEntry as-is; only the cost inputs
 * (ProductVariant.baseCost, Order.courierCost/handlingCost, AdSpendEntry)
 * are new. The Financial Truth Invariant (§3.12) applies unchanged: only
 * confirmed+ orders ever contribute to a profit figure.
 */
describe("Automated Profit & Loss Engine (e2e) - SRS §5.42, §14.42", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let s3: TestS3Server;

  beforeAll(async () => {
    s3 = await startTestS3Server(S3_TEST_PORT, BUCKET);
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
    await s3.close();
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
    // Same checkout-prerequisite precedent as orders.e2e-spec.ts - not this file's focus.
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
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function createSupplierProduct(
    sellerToken: string,
    storeId: string,
    storeSlug: string,
    input: { price: number; shippingCost: number },
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
    return { productId: approve.body.product.id as string, variantId: variant.id as string };
  }

  const shippingAddress = {
    fullName: "Ayesha Khan",
    line1: "House 12, Street 3",
    city: "Lahore",
    country: "PK",
    phone: "03001234567",
  };

  it("FR-42.2: per-order net profit is arithmetically correct for a mixed cart, a partial discount, and a non-zero tax rate", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("pnl-mixed@example.com", "pnl-mixed-store");

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
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/products/${self.productId}/variants/${self.variantId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ baseCost: 200 });
    const supplier = await createSupplierProduct(token, storeId, "pnl-mixed-store", { price: 300, shippingCost: 50 });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/products/${supplier.productId}/variants/${supplier.variantId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ baseCost: 150 });

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
    expect(checkout.status).toBe(201);

    // Sanity-check the hand-computed totals match the real system before
    // trusting the profit figure derived from them.
    expect(checkout.body.discountAmount).toBe("100");
    expect(checkout.body.shippingAmount).toBe("130"); // 80 (self flat) + 50 (supplier)
    expect(checkout.body.taxAmount).toBe("120"); // (1300 - 100) * 10%
    expect(checkout.body.totalAmount).toBe("1450"); // 1200 + 130 + 120

    const orderId = checkout.body.id as string;
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/orders/${orderId}/costs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ courierCost: 20, handlingCost: 10 });

    const actualCommission = await superuser.ledgerEntry.aggregate({
      where: { orderId, type: { in: ["commission_accrued", "commission_waived"] } },
      _sum: { amount: true },
    });
    const commission = Number(actualCommission._sum.amount ?? 0);

    const profit = await request(app.getHttpServer())
      .get(`/stores/${storeId}/pnl/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(profit.status).toBe(200);
    expect(profit.body.revenue).toBe(1330); // totalAmount(1450) - taxAmount(120)
    expect(profit.body.commission).toBe(commission);
    expect(profit.body.cogs).toBe(550); // (200*2) + (150*1)
    expect(profit.body.courierCost).toBe(20);
    expect(profit.body.handlingCost).toBe(10);
    expect(profit.body.incomplete).toBe(false);
    // Hand-computed: 1330 - commission - 550 - 20 - 10 = 750 - commission
    expect(profit.body.netProfit).toBe(750 - commission);
  });

  it("FR-42.4: a pending (unconfirmed) order contributes exactly zero to any profit figure - never appears in P&L", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("pnl-pending@example.com", "pnl-pending-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/products/${productId}/variants/${variantId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ baseCost: 100 });

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.body.status).toBe("pending");
    const orderId = checkout.body.id as string;

    // Still pending - no profit figure exists for it at all.
    const profit = await request(app.getHttpServer())
      .get(`/stores/${storeId}/pnl/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(profit.status).toBe(400);

    // And it's invisible to period aggregation too.
    const today = new Date().toISOString().slice(0, 10);
    const period = await request(app.getHttpServer())
      .get(`/stores/${storeId}/pnl/period`)
      .query({ periodStart: today, periodEnd: today })
      .set("Authorization", `Bearer ${token}`);
    expect(period.body.orderCount).toBe(0);
    expect(period.body.revenue).toBe(0);
    expect(period.body.netProfit).toBe(0);
  });

  it("FR-42.1/42.2: an order with a variant missing its base cost renders profit as incomplete, never silently treating the missing cost as zero", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("pnl-incomplete@example.com", "pnl-incomplete-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    // Deliberately never sets baseCost.

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

    const profit = await request(app.getHttpServer())
      .get(`/stores/${storeId}/pnl/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(profit.body.incomplete).toBe(true);
    expect(profit.body.cogs).toBe(0); // contributes 0, not excluded from the response entirely
  });

  it("FR-42.3: per-period net profit sums only orders placed within the period and only ad-spend entries whose period overlaps it", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("pnl-period@example.com", "pnl-period-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/products/${productId}/variants/${variantId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ baseCost: 0 });

    async function placeAndConfirmOrder(placedAt: Date) {
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
      await superuser.order.update({ where: { id: orderId }, data: { placedAt } });
      return orderId;
    }

    const inRangeOrderId = await placeAndConfirmOrder(new Date("2026-01-15T12:00:00.000Z"));
    await placeAndConfirmOrder(new Date("2026-02-05T12:00:00.000Z")); // outside the requested January range

    // Ad-spend: one entry fully inside January, one entirely in February.
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/pnl/ad-spend`)
      .set("Authorization", `Bearer ${token}`)
      .send({ periodStart: "2026-01-01", periodEnd: "2026-01-31", amount: 200, note: "Jan spend" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/pnl/ad-spend`)
      .set("Authorization", `Bearer ${token}`)
      .send({ periodStart: "2026-02-01", periodEnd: "2026-02-28", amount: 999, note: "Feb spend" });

    const period = await request(app.getHttpServer())
      .get(`/stores/${storeId}/pnl/period`)
      .query({ periodStart: "2026-01-01", periodEnd: "2026-01-31" })
      .set("Authorization", `Bearer ${token}`);
    expect(period.body.orderCount).toBe(1);
    expect(period.body.adSpend).toBe(200);

    const singleOrderProfit = await request(app.getHttpServer())
      .get(`/stores/${storeId}/pnl/orders/${inRangeOrderId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(period.body.revenue).toBe(singleOrderProfit.body.revenue);
  });

  it("FR-42.1: manual and CSV ad-spend entries both land in the same list, scoped to their store", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("pnl-adspend@example.com", "pnl-adspend-store");

    const manual = await request(app.getHttpServer())
      .post(`/stores/${storeId}/pnl/ad-spend`)
      .set("Authorization", `Bearer ${token}`)
      .send({ periodStart: "2026-03-01", periodEnd: "2026-03-31", amount: 150, note: "Manual entry" });
    expect(manual.status).toBe(201);
    expect(manual.body.source).toBe("manual");

    const csv = "PeriodStart,PeriodEnd,Amount,Note\n2026-04-01,2026-04-30,75,CSV row\n";
    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/ad-spend-import-jobs`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from(csv), "ad-spend.csv");
    expect(upload.status).toBe(201);

    const productImport = app.get(ProductImportService);
    await productImport.process(upload.body.id);

    const list = await request(app.getHttpServer())
      .get(`/stores/${storeId}/pnl/ad-spend`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.some((e: { source: string; amount: string }) => e.source === "manual" && Number(e.amount) === 150)).toBe(true);
    expect(list.body.some((e: { source: string; amount: string }) => e.source === "csv_import" && Number(e.amount) === 75)).toBe(true);
  });

  it("FR-42.5: RLS denies cross-tenant access to another seller's cost/profit data, at both the app layer and the database level", async () => {
    const sellerA = await signupLoginAndCreateStore("pnl-tenant-a@example.com", "pnl-tenant-a-store");
    const sellerB = await signupLoginAndCreateStore("pnl-tenant-b@example.com", "pnl-tenant-b-store");
    const { productId, variantId } = await createSelfProduct(sellerA.token, sellerA.storeId, 1000);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname: sellerA.hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname: sellerA.hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const orderId = checkout.body.id as string;
    await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${sellerA.token}`);

    const crossProfit = await request(app.getHttpServer())
      .get(`/stores/${sellerA.storeId}/pnl/orders/${orderId}`)
      .set("Authorization", `Bearer ${sellerB.token}`);
    expect(crossProfit.status).toBe(404);

    const adSpend = await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/pnl/ad-spend`)
      .set("Authorization", `Bearer ${sellerA.token}`)
      .send({ periodStart: "2026-01-01", periodEnd: "2026-01-31", amount: 100 });
    const crossList = await request(app.getHttpServer())
      .get(`/stores/${sellerA.storeId}/pnl/ad-spend`)
      .set("Authorization", `Bearer ${sellerB.token}`);
    expect(crossList.status).toBe(200);
    expect(crossList.body).toEqual([]);

    // RLS itself, independent of the app layer.
    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const asSellerB = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerB.sellerId}'`);
      return tx.adSpendEntry.findMany({ where: { id: adSpend.body.id } });
    });
    expect(asSellerB).toEqual([]);
    await runtime.$disconnect();
  });
});
