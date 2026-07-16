import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const S3_TEST_PORT = 4569;
const BUCKET = "goto5x-media-test";

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
      .send({ email, password: "correct-horse-battery", businessName: `Business for ${email}` });
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
    const fileBytes = Buffer.from("fake-png-bytes-for-testing");

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

  it("lists media for a store, attaches one to a product, then detaches it", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("media-attach@example.com", "media-attach-store");
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Needs A Photo" });
    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("photo-bytes"), { filename: "p.jpg", contentType: "image/jpeg" });
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
      .attach("file", Buffer.from("delete-me"), { filename: "d.png", contentType: "image/png" });
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
      .attach("file", Buffer.from("intrusion"), { filename: "x.png", contentType: "image/png" });
    expect(crossUpload.status).toBe(404);
  });
});
