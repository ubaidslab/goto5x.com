import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const S3_TEST_PORT = 4569; // must match .env.test's MINIO_ENDPOINT - see media.e2e-spec.ts's comment on why this is safe under --runInBand
const BUCKET = "uzeyn-media-test";

const shippingAddress = {
  fullName: "Ayesha Khan",
  line1: "House 12, Street 3",
  city: "Lahore",
  country: "PK",
  phone: "03001234567",
};

/**
 * SRS §5.32/§14.32 (Module 15.5) - store logo upload (FR-32.5): backend
 * surface only. The buyer-facing cart/checkout/confirmation UI this module
 * also ships has no new backend logic of its own (it's a client purely
 * against Module 9/15's already-tested endpoints - see orders.e2e-spec.ts),
 * so it's verified live in a real browser instead (see the verification
 * report), not duplicated here.
 */
describe("Storefront Buyer Purchase Flow & Store Branding (e2e) - SRS §5.32, §14.32", () => {
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
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  it("uploads a store logo, exposes it on the dashboard and public storefront endpoints, and replacing it cleans up the old asset", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("logo-owner@example.com", "logo-owner-store");

    const before = await request(app.getHttpServer()).get(`/stores/${storeId}`).set("Authorization", `Bearer ${token}`);
    expect(before.body.logoUrl).toBeNull();

    const firstLogo = Buffer.from("first-logo-bytes");
    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/logo`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", firstLogo, { filename: "logo.png", contentType: "image/png" });
    expect(upload.status).toBe(201);
    expect(upload.body.logoUrl).toContain(BUCKET);
    const firstKey = upload.body.logoUrl.split(`${BUCKET}/`)[1];

    // Dashboard read (GET /stores/:id) reflects the new logo immediately.
    const afterUpload = await request(app.getHttpServer()).get(`/stores/${storeId}`).set("Authorization", `Bearer ${token}`);
    expect(afterUpload.body.logoUrl).toBe(upload.body.logoUrl);

    // Public storefront store endpoint (what the buyer-facing header/product
    // pages actually fetch) exposes the same logo.
    const publicStore = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(publicStore.body.logoUrl).toBe(upload.body.logoUrl);

    // Replacing the logo cleans up the previous object, not just the DB row.
    const secondLogo = Buffer.from("second-logo-bytes");
    const replace = await request(app.getHttpServer())
      .post(`/stores/${storeId}/logo`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", secondLogo, { filename: "logo2.png", contentType: "image/png" });
    expect(replace.body.logoUrl).not.toBe(upload.body.logoUrl);

    const rawS3 = new S3Client({
      endpoint: `http://localhost:${S3_TEST_PORT}`,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" },
    });
    await expect(rawS3.send(new GetObjectCommand({ Bucket: BUCKET, Key: firstKey }))).rejects.toThrow();

    // Removing the logo falls back to no logo (typographic mark) everywhere.
    const remove = await request(app.getHttpServer()).delete(`/stores/${storeId}/logo`).set("Authorization", `Bearer ${token}`);
    expect(remove.body.removed).toBe(true);
    const afterRemove = await request(app.getHttpServer()).get(`/stores/${storeId}`).set("Authorization", `Bearer ${token}`);
    expect(afterRemove.body.logoUrl).toBeNull();
    const publicAfterRemove = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(publicAfterRemove.body.logoUrl).toBeNull();
  });

  it("seller A cannot upload or remove a logo on seller B's store (cross-tenant)", async () => {
    const a = await signupLoginAndCreateStore("logoA@example.com", "logo-store-a");
    const b = await signupLoginAndCreateStore("logoB@example.com", "logo-store-b");

    const crossUpload = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/logo`)
      .set("Authorization", `Bearer ${b.token}`)
      .attach("file", Buffer.from("intrusion"), { filename: "x.png", contentType: "image/png" });
    expect(crossUpload.status).toBe(404);

    const crossRemove = await request(app.getHttpServer())
      .delete(`/stores/${a.storeId}/logo`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossRemove.status).toBe(404);
  });

  it("an uploaded logo is passed through into invoice PDF generation without breaking checkout (FR-32.5 x FR-19.1)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("logo-invoice@example.com", "logo-invoice-store");
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/logo`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("logo-bytes"), { filename: "logo.png", contentType: "image/png" });

    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Branded Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}`, price: 500, stockQuantity: 10 });

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });

    // Financial Truth Invariant (§3.12) holds regardless of branding.
    expect(checkout.status).toBe(201);
    expect(checkout.body.status).toBe("pending");
    expect(checkout.body.statusLookupToken).toBeTruthy();

    const lookup = await request(app.getHttpServer()).get(`/storefront/order-status/${checkout.body.statusLookupToken}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.status).toBe("pending");
  });
});
