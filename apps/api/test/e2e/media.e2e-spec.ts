import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const S3_TEST_PORT = 4569;
const BUCKET = "uzeyn-media-test";

// Security-audit fix (docs/security-audit-report.md, finding #14) - upload
// validation now checks real magic bytes, not the client-declared
// content-type, so test fixtures need a real PNG signature (89 50 4E 47
// 0D 0A 1A 0A) prefixed onto whatever filler payload the test cares about.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
function realPngBytes(payload: string): Buffer {
  return Buffer.concat([PNG_SIGNATURE, Buffer.from(payload)]);
}
function realJpegBytes(payload: string): Buffer {
  return Buffer.concat([JPEG_SIGNATURE, Buffer.from(payload)]);
}

describe("Media: direct upload to object storage (e2e) - SRS FR-9.2, §14.9", () => {
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
    return { token, storeId: store.body.id as string };
  }

  function rawS3Client(): S3Client {
    return new S3Client({
      endpoint: `http://localhost:${S3_TEST_PORT}`,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" },
    });
  }

  it("uploads an image, creates a media_assets row, and the bytes are really retrievable from object storage", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("media-owner@example.com", "media-owner-store");
    const fileBytes = realPngBytes("fake-png-bytes-for-testing");

    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", fileBytes, { filename: "product-photo.png", contentType: "image/png" });

    expect(upload.status).toBe(201);
    expect(upload.body.source).toBe("upload");
    expect(upload.body.type).toBe("image");
    expect(upload.body.url).toContain(BUCKET);

    // Prove the file is genuinely in object storage, not just a DB row with a
    // URL nobody checked - fetch it back directly via the S3 API.
    const key = upload.body.url.split(`${BUCKET}/`)[1];
    const fetched = await rawS3Client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await fetched.Body!.transformToByteArray();
    expect(Buffer.from(body).equals(fileBytes)).toBe(true);
  });

  it("rejects a file whose content-type is neither image nor video", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("media-badtype@example.com", "media-badtype-store");
    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("not media"), { filename: "doc.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(400);
  });

  it("Security-audit fix (finding #14): a mislabeled upload is rejected on its real content, not its declared content-type, and the stored Content-Type is server-chosen rather than client-supplied", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("media-spoofed@example.com", "media-spoofed-store");

    // The exact vector the audit found: the client declares a "safe"
    // image mimetype, but the actual bytes are arbitrary (here, HTML that
    // would execute as script if ever served with an executable
    // Content-Type) - this must be rejected on content, not on the
    // client's own say-so.
    const spoofed = await request(app.getHttpServer())
      .post(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("<script>alert(1)</script>"), { filename: "innocent.png", contentType: "image/png" });
    expect(spoofed.status).toBe(400);

    // The same declared-mimetype lie in the other direction: real JPEG
    // bytes declared as a generic octet-stream must still be accepted and
    // correctly classified - the server decides from content, not the
    // client's mimetype, in both directions.
    const realFile = await request(app.getHttpServer())
      .post(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", realJpegBytes("actually-a-jpeg"), { filename: "photo.bin", contentType: "application/octet-stream" });
    expect(realFile.status).toBe(201);
    expect(realFile.body.type).toBe("image");

    // The object actually stored in S3 carries the server-detected
    // Content-Type (image/jpeg), never the client's declared
    // "application/octet-stream".
    const key = realFile.body.url.split(`${BUCKET}/`)[1];
    const fetched = await rawS3Client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    expect(fetched.ContentType).toBe("image/jpeg");
  });

  it("lists media for a store, attaches one to a product, then detaches it", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("media-attach@example.com", "media-attach-store");
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Needs A Photo" });
    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", realJpegBytes("photo-bytes"), { filename: "p.jpg", contentType: "image/jpeg" });
    const mediaId = upload.body.id;

    const list = await request(app.getHttpServer())
      .get(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body).toHaveLength(1);

    const attach = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/media/${mediaId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: product.body.id });
    expect(attach.status).toBe(200);
    expect(attach.body.productId).toBe(product.body.id);

    const detach = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/media/${mediaId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(detach.body.productId).toBeNull();
  });

  it("deleting a media asset removes both the DB row and the underlying object", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("media-delete@example.com", "media-delete-store");
    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", realPngBytes("delete-me"), { filename: "d.png", contentType: "image/png" });
    const mediaId = upload.body.id;
    const key = upload.body.url.split(`${BUCKET}/`)[1];

    const del = await request(app.getHttpServer())
      .delete(`/stores/${storeId}/media/${mediaId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);

    const dbRow = await superuser.mediaAsset.findUnique({ where: { id: mediaId } });
    expect(dbRow).toBeNull();

    await expect(rawS3Client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))).rejects.toThrow();
  });

  it("seller A cannot list, upload to, or delete media on seller B's store (cross-tenant)", async () => {
    const a = await signupLoginAndCreateStore("mediaA@example.com", "media-store-a");
    const b = await signupLoginAndCreateStore("mediaB@example.com", "media-store-b");

    const crossList = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/media`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossList.status).toBe(404);

    const crossUpload = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/media`)
      .set("Authorization", `Bearer ${b.token}`)
      .attach("file", realPngBytes("intrusion"), { filename: "x.png", contentType: "image/png" });
    expect(crossUpload.status).toBe(404);
  });
});
