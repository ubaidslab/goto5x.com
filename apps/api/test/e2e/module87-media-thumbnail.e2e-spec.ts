import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const S3_TEST_PORT = 4569;
const BUCKET = "uzeyn-media-test";
const PASSWORD = "correct-horse-battery";

/**
 * FR-66.7 (Module 87) - image zoom + product video with thumbnail. Image
 * zoom is a pure frontend interaction (no backend surface to test); this
 * covers the one new backend surface: a seller-chosen poster image for a
 * video MediaAsset (MediaAsset.thumbnailMediaId), the storefront exposing
 * it as a resolved thumbnailUrl, and media now being read in sortOrder
 * (a real pre-existing gap this batch's research also surfaced).
 */
describe("Product video thumbnail (e2e) - FR-66.7 (Module 87)", () => {
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
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function uploadMedia(token: string, storeId: string, productId: string, kind: "image" | "video", filename: string) {
    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`)
      .field("productId", productId)
      .attach("file", Buffer.from(`fake-${kind}-bytes`), {
        filename,
        contentType: kind === "image" ? "image/png" : "video/mp4",
      });
    return upload.body.id as string;
  }

  it("sets, resolves, and clears a video's thumbnail; rejects a non-video target and a non-image thumbnail", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("mediathumb-basic@example.com", "mediathumb-basic-store");
    await superuser.seller.update({
      where: { id: (await superuser.store.findUniqueOrThrow({ where: { id: storeId } })).sellerId },
      data: { isTrusted: true },
    });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Product With Video", status: "active" });
    const productId = product.body.id as string;

    const imageId = await uploadMedia(token, storeId, productId, "image", "poster.png");
    const videoId = await uploadMedia(token, storeId, productId, "video", "clip.mp4");

    // Only a video asset may have a thumbnail set.
    const onImage = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/media/${imageId}/thumbnail`)
      .set("Authorization", `Bearer ${token}`)
      .send({ thumbnailMediaId: null });
    expect(onImage.status).toBe(400);

    // The thumbnail itself must be an image, not another video.
    const videoAsThumbnail = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/media/${videoId}/thumbnail`)
      .set("Authorization", `Bearer ${token}`)
      .send({ thumbnailMediaId: videoId });
    expect(videoAsThumbnail.status).toBe(400);

    const setThumb = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/media/${videoId}/thumbnail`)
      .set("Authorization", `Bearer ${token}`)
      .send({ thumbnailMediaId: imageId });
    expect(setThumb.status).toBe(200);
    expect(setThumb.body.thumbnailMedia).toMatchObject({ id: imageId });

    // The storefront resolves it to a URL, not the raw id.
    const publicProduct = await request(app.getHttpServer()).get(`/storefront/products/${productId}`).query({ hostname });
    expect(publicProduct.status).toBe(200);
    const publicVideo = publicProduct.body.media.find((m: { id: string }) => m.id === videoId);
    expect(publicVideo).toMatchObject({ type: "video", thumbnailUrl: expect.stringContaining(BUCKET) });
    const publicImage = publicProduct.body.media.find((m: { id: string }) => m.id === imageId);
    expect(publicImage).toMatchObject({ type: "image", thumbnailUrl: null });

    // Clearing it back to null works.
    const clear = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/media/${videoId}/thumbnail`)
      .set("Authorization", `Bearer ${token}`)
      .send({ thumbnailMediaId: null });
    expect(clear.status).toBe(200);
    expect(clear.body.thumbnailMedia).toBeNull();
  });

  it("rejects a thumbnail pointing at another store's media", async () => {
    const a = await signupLoginAndCreateStore("mediathumb-a@example.com", "mediathumb-a-store");
    const b = await signupLoginAndCreateStore("mediathumb-b@example.com", "mediathumb-b-store");
    const productA = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/products`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ title: "Store A Product" });
    const productB = await request(app.getHttpServer())
      .post(`/stores/${b.storeId}/products`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ title: "Store B Product" });

    const videoA = await uploadMedia(a.token, a.storeId, productA.body.id, "video", "a.mp4");
    const imageB = await uploadMedia(b.token, b.storeId, productB.body.id, "image", "b.png");

    const res = await request(app.getHttpServer())
      .patch(`/stores/${a.storeId}/media/${videoA}/thumbnail`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ thumbnailMediaId: imageB });
    expect(res.status).toBe(404);
  });

  it("the storefront reads a product's media in sortOrder, not insertion order", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("mediathumb-order@example.com", "mediathumb-order-store");
    await superuser.seller.update({
      where: { id: (await superuser.store.findUniqueOrThrow({ where: { id: storeId } })).sellerId },
      data: { isTrusted: true },
    });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Ordered Product", status: "active" });
    const productId = product.body.id as string;

    const firstId = await uploadMedia(token, storeId, productId, "image", "first.png");
    const secondId = await uploadMedia(token, storeId, productId, "image", "second.png");

    // Reverse the order: second becomes sortOrder 0, first becomes 1.
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/media/reorder`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId, mediaIds: [secondId, firstId] });

    const publicProduct = await request(app.getHttpServer()).get(`/storefront/products/${productId}`).query({ hostname });
    expect(publicProduct.body.media.map((m: { id: string }) => m.id)).toEqual([secondId, firstId]);
  });
});
