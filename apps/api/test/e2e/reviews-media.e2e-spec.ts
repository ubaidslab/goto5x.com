import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const S3_TEST_PORT = 4569;
const BUCKET = "uzeyn-media-test";
const PASSWORD = "correct-horse-battery";

/**
 * Phase 4 close-out (FR-14.1) - the review-media (photo/video) attachment
 * feature the original UI/UX audit found genuinely missing end-to-end (no
 * schema, no upload path, no moderation-side surface). Buyer upload is a
 * second step after submit() (which stays JSON-only, untouched), scoped to
 * the review the buyer's own order-status token actually owns.
 */
describe("Review media - photos/video (e2e) - Phase 4 close-out, FR-14.1", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let s3: TestS3Server;

  const shippingAddress = { fullName: "Ayesha Khan", line1: "House 12, Street 3", city: "Lahore", country: "PK", phone: "03001234567" };

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
      .send({ title: "Self-Fulfilled Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
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
    await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
    return { orderId, statusLookupToken: checkout.body.statusLookupToken as string };
  }

  it("a buyer can attach photos/video to their own review right after submitting it, and the seller sees them on moderation", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("review-media-seller@example.com", "review-media-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1500);
    const { statusLookupToken } = await checkoutAndPay(token, storeId, hostname, productId, variantId, "review-media-buyer@example.com");

    const submit = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews`)
      .send({ productId, buyerName: "Reviewer One", rating: 5, body: "Great product, here are photos!" });
    expect(submit.status).toBe(201);
    const reviewId = submit.body.id as string;

    const upload = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews/${reviewId}/media`)
      .attach("media", Buffer.from("fake-jpeg-bytes"), { filename: "photo1.jpg", contentType: "image/jpeg" })
      .attach("media", Buffer.from("fake-mp4-bytes"), { filename: "clip.mp4", contentType: "video/mp4" });
    expect(upload.status).toBe(201);
    expect(upload.body).toHaveLength(2);
    expect(upload.body.map((m: any) => m.type).sort()).toEqual(["image", "video"]);
    expect(upload.body.every((m: any) => typeof m.url === "string" && m.url.includes(BUCKET))).toBe(true);

    const moderationList = await request(app.getHttpServer())
      .get(`/stores/${storeId}/reviews?status=pending`)
      .set("Authorization", `Bearer ${token}`);
    expect(moderationList.status).toBe(200);
    expect(moderationList.body[0].media).toHaveLength(2);
  });

  it("rejects a non-image/video file type", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("review-media-badtype@example.com", "review-media-badtype-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    const { statusLookupToken } = await checkoutAndPay(token, storeId, hostname, productId, variantId, "badtype-buyer@example.com");
    const submit = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews`)
      .send({ productId, buyerName: "Reviewer", rating: 3, body: "ok" });

    const upload = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews/${submit.body.id}/media`)
      .attach("media", Buffer.from("not media"), { filename: "doc.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(400);

    const media = await superuser.reviewMedia.findMany({ where: { reviewId: submit.body.id } });
    expect(media).toHaveLength(0);
  });

  it("caps a review at 5 attachments total, and never partially uploads when the cap would be exceeded", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("review-media-cap@example.com", "review-media-cap-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    const { statusLookupToken } = await checkoutAndPay(token, storeId, hostname, productId, variantId, "cap-buyer@example.com");
    const submit = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews`)
      .send({ productId, buyerName: "Reviewer", rating: 4, body: "ok" });

    let req = request(app.getHttpServer()).post(`/storefront/order-status/${statusLookupToken}/reviews/${submit.body.id}/media`);
    for (let i = 0; i < 5; i++) {
      req = req.attach("media", Buffer.from(`img-${i}`), { filename: `img${i}.jpg`, contentType: "image/jpeg" });
    }
    const firstBatch = await req;
    expect(firstBatch.status).toBe(201);
    expect(firstBatch.body).toHaveLength(5);

    const overCap = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews/${submit.body.id}/media`)
      .attach("media", Buffer.from("one-more"), { filename: "onemore.jpg", contentType: "image/jpeg" });
    expect(overCap.status).toBe(400);

    const media = await superuser.reviewMedia.findMany({ where: { reviewId: submit.body.id } });
    expect(media).toHaveLength(5);
  });

  it("a review from a different buyer's order-status token cannot have media attached to it", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("review-media-cross@example.com", "review-media-cross-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);
    const a = await checkoutAndPay(token, storeId, hostname, productId, variantId, "cross-buyer-a@example.com");
    const b = await checkoutAndPay(token, storeId, hostname, productId, variantId, "cross-buyer-b@example.com");

    const submitA = await request(app.getHttpServer())
      .post(`/storefront/order-status/${a.statusLookupToken}/reviews`)
      .send({ productId, buyerName: "Buyer A", rating: 5, body: "A's review" });

    const crossUpload = await request(app.getHttpServer())
      .post(`/storefront/order-status/${b.statusLookupToken}/reviews/${submitA.body.id}/media`)
      .attach("media", Buffer.from("intrusion"), { filename: "x.jpg", contentType: "image/jpeg" });
    expect(crossUpload.status).toBe(404);
  });

  it("Tenant isolation: a seller cannot see another store's review media via moderation", async () => {
    const a = await signupLoginAndCreateStore("review-media-tenant-a@example.com", "review-media-tenant-a-store");
    const b = await signupLoginAndCreateStore("review-media-tenant-b@example.com", "review-media-tenant-b-store");
    const { productId, variantId } = await createSelfProduct(a.token, a.storeId, 1000);
    const { statusLookupToken } = await checkoutAndPay(a.token, a.storeId, a.hostname, productId, variantId, "tenant-buyer@example.com");
    const submit = await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews`)
      .send({ productId, buyerName: "Buyer", rating: 5, body: "review" });
    await request(app.getHttpServer())
      .post(`/storefront/order-status/${statusLookupToken}/reviews/${submit.body.id}/media`)
      .attach("media", Buffer.from("photo"), { filename: "p.jpg", contentType: "image/jpeg" });

    // Same RLS-enforced "store not found" shape as every other cross-tenant
    // access attempt in this codebase (listForModeration() looks the store
    // up under seller B's own RLS context, where store A's row doesn't exist).
    const crossList = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/reviews`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossList.status).toBe(404);
  });
});
