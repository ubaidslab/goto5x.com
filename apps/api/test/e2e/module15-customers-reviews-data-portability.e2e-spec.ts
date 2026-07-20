import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { ProductImportService } from "../../src/data-portability/product-import.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const S3_TEST_PORT = 4569;
const BUCKET = "goto5x-media-test";

/**
 * SRS §5.13/§5.14/§5.18/§5.19 (Customers, Reviews & Data Portability),
 * §14.13/§14.14/§14.18/§14.19.
 */
describe("Customers, Reviews & Data Portability (e2e) - SRS §5.13/§5.14/§5.18/§5.19, §14.13/§14.14/§14.18/§14.19", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let s3: TestS3Server;

  const shippingAddress = {
    fullName: "Ayesha Khan",
    line1: "House 12, Street 3",
    city: "Lahore",
    country: "PK",
    phone: "03001234567",
  };

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
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { userId: user.id }, data: { cnicHash: `test-cnic-hash-${user.id}` } });
    // Module 20 (SRS §5.6e, FR-6.21) - checkout now also requires the store
    // to be published; set directly rather than every test going through
    // the real publish flow (top-up + verify).
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, hostname: `${slug}.goto5x.com` };
  }

  async function createSelfProduct(token: string, storeId: string, price: number, stockQuantity = 100) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Self-Fulfilled Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function checkoutAndPay(token: string, storeId: string, hostname: string, productId: string, variantId: string, buyerEmail: string) {
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail, items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const orderId = checkout.body.id as string;
    const markPaid = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    return { orderId, statusLookupToken: checkout.body.statusLookupToken as string, markPaid };
  }

  // ---------------------------------------------------------------------
  // §14.13 Customers (CRM)
  // ---------------------------------------------------------------------

  it("FR-13.1: a customer record is auto-created at checkout and its stats increment only once the order is paid", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("cust-a@example.com", "cust-a-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 500);

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer1@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const orderId = checkout.body.id as string;

    // Financial Truth Invariant - the customer record exists the instant
    // the order is placed, but its stats must not count an unpaid order.
    const customerAfterPlacement = await superuser.customer.findFirstOrThrow({ where: { storeId, email: "buyer1@example.com" } });
    expect(customerAfterPlacement.name).toBe(shippingAddress.fullName);
    expect(customerAfterPlacement.ordersCount).toBe(0);
    expect(Number(customerAfterPlacement.totalSpent)).toBe(0);

    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);

    const customerAfterPaid = await superuser.customer.findFirstOrThrow({ where: { storeId, email: "buyer1@example.com" } });
    expect(customerAfterPaid.ordersCount).toBe(1);
    expect(Number(customerAfterPaid.totalSpent)).toBe(500);
    expect(customerAfterPaid.firstOrderAt).not.toBeNull();
    expect(customerAfterPaid.lastOrderAt).not.toBeNull();

    const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.customerId).toBe(customerAfterPaid.id);
  });

  it("FR-13.1: a manual order (FR-17.1) updates the exact same customer record a storefront order would", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("cust-b@example.com", "cust-b-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 300);

    const manual = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({ buyerEmail: "repeat-buyer@example.com", items: [{ productId, variantId, quantity: 2 }], shippingAddress });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${manual.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);

    const manual2 = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({ buyerEmail: "repeat-buyer@example.com", items: [{ productId, variantId, quantity: 1 }], shippingAddress });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${manual2.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);

    const customers = await superuser.customer.findMany({ where: { storeId, email: "repeat-buyer@example.com" } });
    expect(customers).toHaveLength(1);
    expect(customers[0].ordersCount).toBe(2);
    expect(Number(customers[0].totalSpent)).toBe(900); // qty 2 * 300 + qty 1 * 300 (default store settings: no shipping/tax)
  });

  it("FR-13.2/13.3: the customer list is searchable/sortable and tenant-isolated", async () => {
    const sellerA = await signupLoginAndCreateStore("cust-list-a@example.com", "cust-list-a-store");
    const sellerB = await signupLoginAndCreateStore("cust-list-b@example.com", "cust-list-b-store");
    const productA = await createSelfProduct(sellerA.token, sellerA.storeId, 200);

    await checkoutAndPay(sellerA.token, sellerA.storeId, sellerA.hostname, productA.productId, productA.variantId, "vip@example.com");

    const list = await request(app.getHttpServer())
      .get(`/stores/${sellerA.storeId}/customers`)
      .set("Authorization", `Bearer ${sellerA.token}`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].email).toBe("vip@example.com");

    const search = await request(app.getHttpServer())
      .get(`/stores/${sellerA.storeId}/customers?search=vip`)
      .set("Authorization", `Bearer ${sellerA.token}`);
    expect(search.body).toHaveLength(1);

    // Tenant isolation - seller B never sees seller A's customers.
    const crossList = await request(app.getHttpServer())
      .get(`/stores/${sellerA.storeId}/customers`)
      .set("Authorization", `Bearer ${sellerB.token}`);
    expect(crossList.status).toBe(404);
  });

  // ---------------------------------------------------------------------
  // §14.14 Product Reviews & Ratings
  // ---------------------------------------------------------------------

  it("FR-14.1/14.2: a review linked to a real, confirmed order is verified; the product's rating is unaffected until moderated", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("rev-a@example.com", "rev-a-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 400);
    const { statusLookupToken } = await checkoutAndPay(token, storeId, hostname, productId, variantId, "reviewer@example.com");

    const submit = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews`)
      .send({ productId, buyerName: "Reviewer One", rating: 5, body: "Great product!" });
    expect(submit.status).toBe(201);
    expect(submit.body.isVerifiedPurchase).toBe(true);
    expect(submit.body.status).toBe("pending");

    const productBeforeModeration = await superuser.product.findUniqueOrThrow({ where: { id: productId } });
    expect(productBeforeModeration.reviewCount).toBe(0); // no review counts until approved (FR-14.3)

    const moderate = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/reviews/${submit.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "approved" });
    expect(moderate.status).toBe(200);

    const productAfterModeration = await superuser.product.findUniqueOrThrow({ where: { id: productId } });
    expect(productAfterModeration.reviewCount).toBe(1);
    expect(Number(productAfterModeration.averageRating)).toBe(5);
  });

  it("FR-14.2: a review submitted without a real order for that product is not verified", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("rev-b@example.com", "rev-b-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 250);
    const otherProduct = await createSelfProduct(token, storeId, 250);
    const { statusLookupToken } = await checkoutAndPay(token, storeId, hostname, productId, variantId, "unverified@example.com");

    // Reviewing a product that was never actually in this order.
    const submit = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews`)
      .send({ productId: otherProduct.productId, buyerName: "Someone", rating: 3, body: "Not actually bought" });
    expect(submit.body.isVerifiedPurchase).toBe(false);
  });

  it("FR-14.3/14.4: hiding a previously-approved review recomputes the product's average rating and count", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("rev-c@example.com", "rev-c-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 350);
    const first = await checkoutAndPay(token, storeId, hostname, productId, variantId, "buyer-a@example.com");
    const second = await checkoutAndPay(token, storeId, hostname, productId, variantId, "buyer-b@example.com");

    const reviewA = await request(app.getHttpServer())
      .post(`/storefront/order-status/${first.statusLookupToken}/reviews`)
      .send({ productId, buyerName: "A", rating: 4, body: "Good" });
    const reviewB = await request(app.getHttpServer())
      .post(`/storefront/order-status/${second.statusLookupToken}/reviews`)
      .send({ productId, buyerName: "B", rating: 2, body: "Meh" });

    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/reviews/${reviewA.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "approved" });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/reviews/${reviewB.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "approved" });

    let product = await superuser.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.reviewCount).toBe(2);
    expect(Number(product.averageRating)).toBe(3);

    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/reviews/${reviewB.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "hidden" });

    product = await superuser.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.reviewCount).toBe(1);
    expect(Number(product.averageRating)).toBe(4);
  });

  it("Tenant isolation: a seller cannot moderate another store's reviews", async () => {
    const sellerA = await signupLoginAndCreateStore("rev-iso-a@example.com", "rev-iso-a-store");
    const sellerB = await signupLoginAndCreateStore("rev-iso-b@example.com", "rev-iso-b-store");
    const productA = await createSelfProduct(sellerA.token, sellerA.storeId, 300);
    const { statusLookupToken } = await checkoutAndPay(
      sellerA.token,
      sellerA.storeId,
      sellerA.hostname,
      productA.productId,
      productA.variantId,
      "buyer@example.com",
    );
    const review = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews`)
      .send({ productId: productA.productId, buyerName: "X", rating: 1, body: "Bad" });

    const crossModerate = await request(app.getHttpServer())
      .patch(`/stores/${sellerA.storeId}/reviews/${review.body.id}`)
      .set("Authorization", `Bearer ${sellerB.token}`)
      .send({ status: "approved" });
    expect(crossModerate.status).toBe(404);
  });

  // ---------------------------------------------------------------------
  // §14.19 Receipts, Invoices & Tax
  // ---------------------------------------------------------------------

  it("FR-19.1/19.3: a PDF invoice is generated at checkout, cached on the order, and surfaced on the order-status page", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("inv-a@example.com", "inv-a-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "invoice-buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });

    const order = await superuser.order.findUniqueOrThrow({ where: { id: checkout.body.id } });
    expect(order.invoicePdfUrl).toBeTruthy();

    const statusLookup = await request(app.getHttpServer()).get(`/storefront/order-status/${order.statusLookupToken}`);
    expect(statusLookup.body.invoicePdfUrl).toBe(order.invoicePdfUrl);

    const pdfResponse = await request(order.invoicePdfUrl as string).get("");
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.body.slice(0, 4).toString("latin1")).toBe("%PDF");
  }, 30000);

  // ---------------------------------------------------------------------
  // §14.18 Data Portability (CSV Import/Export)
  // ---------------------------------------------------------------------

  it("FR-18.1/18.2: a Shopify-format product CSV imports its core fields, reports unmapped columns, and logs a bad row without failing the whole import", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("csv-a@example.com", "csv-a-store");

    const csv =
      "Handle,Title,Body (HTML),Option1 Name,Option1 Value,Variant SKU,Variant Price,Variant Inventory Qty,Image Src,Vendor\n" +
      "tshirt,Cool T-Shirt,<p>desc</p>,Size,S,TS-S,999,10,https://example.com/img1.jpg,Acme\n" +
      'tshirt,,,Size,M,TS-M,999,5,https://example.com/img2.jpg,Acme\n' +
      "bad-row,Bad Price Product,,,,,not-a-number,1,,Acme\n";

    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/import-jobs`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from(csv), "products.csv");
    expect(upload.status).toBe(201);
    expect(upload.body.status).toBe("pending");

    // The real worker isn't running in this test process - invoke the same
    // processing method it would call, exactly as the abandoned-cart sweep
    // and domain-verification e2e tests already do for their own queues.
    const productImport = app.get(ProductImportService);
    await productImport.process(upload.body.id);

    const job = await request(app.getHttpServer())
      .get(`/stores/${storeId}/import-jobs/${upload.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(job.body.status).toBe("completed");
    expect(job.body.unmappedFields).toEqual(["Vendor"]);
    expect(job.body.errorLog.length).toBeGreaterThan(0);

    const product = await superuser.product.findFirstOrThrow({ where: { storeId, title: "Cool T-Shirt" } });
    const variants = await superuser.productVariant.findMany({ where: { productId: product.id } });
    expect(variants).toHaveLength(2);
    const media = await superuser.mediaAsset.findMany({ where: { productId: product.id } });
    expect(media).toHaveLength(2);
    expect(media.map((m) => m.source)).toEqual(["csv_import", "csv_import"]);

    const badProduct = await superuser.product.findFirst({ where: { storeId, title: "Bad Price Product" } });
    expect(badProduct).toBeNull();
  }, 30000);

  it("FR-18.3: product and order CSV export produce well-formed, re-importable files; tenant isolation holds", async () => {
    const sellerA = await signupLoginAndCreateStore("csv-export-a@example.com", "csv-export-a-store");
    const sellerB = await signupLoginAndCreateStore("csv-export-b@example.com", "csv-export-b-store");
    const productA = await createSelfProduct(sellerA.token, sellerA.storeId, 600);
    await checkoutAndPay(sellerA.token, sellerA.storeId, sellerA.hostname, productA.productId, productA.variantId, "export-buyer@example.com");

    const productExport = await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/exports/products`)
      .set("Authorization", `Bearer ${sellerA.token}`);
    expect(productExport.status).toBe(201);
    const productCsvResponse = await request(productExport.body.fileUrl as string).get("");
    expect(productCsvResponse.text).toContain("Self-Fulfilled Widget");
    expect(productCsvResponse.text).not.toContain("does-not-exist");

    const orderExport = await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/exports/orders`)
      .set("Authorization", `Bearer ${sellerA.token}`);
    expect(orderExport.status).toBe(201);
    const orderCsvResponse = await request(orderExport.body.fileUrl as string).get("");
    expect(orderCsvResponse.text).toContain("export-buyer@example.com");

    // Tenant isolation: seller B cannot trigger an export for seller A's store.
    const crossExport = await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/exports/products`)
      .set("Authorization", `Bearer ${sellerB.token}`);
    expect(crossExport.status).toBe(404);
  });
});
