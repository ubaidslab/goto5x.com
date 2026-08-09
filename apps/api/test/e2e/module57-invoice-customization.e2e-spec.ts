import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const PASSWORD = "correct-horse-battery";
const S3_TEST_PORT = 4569;
const BUCKET = "uzeyn-media-test";

/**
 * Module 57 (SRS §5.64, §14.63) - Invoice/Receipt Customization, limited.
 * The rendering logic itself (which fields appear, which stay absent, HTML
 * escaping, and the mandatory platform footer) is already fully covered by
 * invoice-template.spec.ts's pure-function unit tests - this file proves
 * the wiring: the three new Store fields round-trip through the seller
 * settings API, and a real checkout with them set still produces a valid,
 * downloadable invoice PDF (same "PDF generation didn't break" proof
 * module15's own invoice e2e test already established for FR-19.1).
 */
describe("Invoice/Receipt Customization, limited (e2e) - SRS §5.64, §14.63", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let s3: TestS3Server;

  beforeAll(async () => {
    // Two of this file's tests drive a real checkout, which triggers
    // InvoicePdfService.generate() -> ObjectStorageService.putObject() -
    // without a fake S3 server listening on MINIO_ENDPOINT, that put fails
    // (best-effort, caught) and invoicePdfUrl silently stays null, same
    // pattern module15/24/28's own S3-touching e2e files already follow.
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

  const shippingAddress = {
    fullName: "Ayesha Khan",
    line1: "House 12, Street 3",
    city: "Lahore",
    country: "PK",
    phone: "03001234567",
  };

  async function signupLoginAndCreateStore(email: string, slug: string, businessName?: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: businessName ?? `Business for ${email}` });
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
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function createSelfProduct(token: string, storeId: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Invoiced Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  it("FR-64.1: a seller can set and read back tax number, invoice footer text, and invoice terms text via the existing store settings screen pattern", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("invcustom-set@example.com", "invcustom-set-store");

    const before = await request(app.getHttpServer()).get(`/stores/${storeId}`).set("Authorization", `Bearer ${token}`);
    expect(before.body.taxNumber).toBeNull();
    expect(before.body.invoiceFooterText).toBeNull();
    expect(before.body.invoiceTermsText).toBeNull();

    const updated = await request(app.getHttpServer())
      .patch(`/stores/${storeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        taxNumber: "1234567-8",
        invoiceFooterText: "Thank you for shopping with us.",
        invoiceTermsText: "All sales are final after 7 days.",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.taxNumber).toBe("1234567-8");
    expect(updated.body.invoiceFooterText).toBe("Thank you for shopping with us.");
    expect(updated.body.invoiceTermsText).toBe("All sales are final after 7 days.");

    const after = await request(app.getHttpServer()).get(`/stores/${storeId}`).set("Authorization", `Bearer ${token}`);
    expect(after.body.taxNumber).toBe("1234567-8");
    expect(after.body.invoiceFooterText).toBe("Thank you for shopping with us.");
    expect(after.body.invoiceTermsText).toBe("All sales are final after 7 days.");
  });

  it("FR-64.1/64.2/64.4: a checkout still generates a valid, downloadable invoice PDF once tax number, footer/terms text, and business name are all set", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore(
      "invcustom-checkout@example.com",
      "invcustom-checkout-store",
      "Ayesha Textiles (Pvt) Ltd",
    );
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        taxNumber: "1234567-8",
        invoiceFooterText: "Thank you for shopping with us.",
        invoiceTermsText: "All sales are final after 7 days.",
      });

    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "invcustom-buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);

    const order = await superuser.order.findUniqueOrThrow({ where: { id: checkout.body.id } });
    expect(order.invoicePdfUrl).toBeTruthy();

    const pdfResponse = await request(order.invoicePdfUrl as string).get("");
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.body.slice(0, 4).toString("latin1")).toBe("%PDF");
  }, 30000);

  it("FR-64.1/64.2: a checkout with none of the customization fields set still generates a valid invoice PDF (nothing is required)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("invcustom-unset@example.com", "invcustom-unset-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 750);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "invcustom-unset-buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);

    const order = await superuser.order.findUniqueOrThrow({ where: { id: checkout.body.id } });
    expect(order.invoicePdfUrl).toBeTruthy();
  }, 30000);

  it("FR-64.1 tenant isolation: RLS denies cross-tenant reads/writes of another store's invoice customization fields", async () => {
    const a = await signupLoginAndCreateStore("invcustom-tenant-a@example.com", "invcustom-tenant-a-store");
    const b = await signupLoginAndCreateStore("invcustom-tenant-b@example.com", "invcustom-tenant-b-store");

    const crossRead = await request(app.getHttpServer()).get(`/stores/${a.storeId}`).set("Authorization", `Bearer ${b.token}`);
    expect(crossRead.status).toBe(404);

    const crossWrite = await request(app.getHttpServer())
      .patch(`/stores/${a.storeId}`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ taxNumber: "should-not-apply" });
    expect(crossWrite.status).toBe(404);

    const stillUnset = await request(app.getHttpServer()).get(`/stores/${a.storeId}`).set("Authorization", `Bearer ${a.token}`);
    expect(stillUnset.body.taxNumber).toBeNull();
  });
});
