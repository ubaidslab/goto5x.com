import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { DRIVE_CLIENT, IDriveClient } from "../../src/media/google-drive/drive-client.interface";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

// Must match .env.test's MINIO_ENDPOINT - that value is static across every
// test file (dotenv-loaded once per file's fresh module registry from the
// same file), so this file's fake s3rver has to bind the same port
// media.e2e-spec.ts uses. Safe because Jest e2e runs files sequentially
// (package.json's `--runInBand`): that file's afterAll has already closed
// its server before this file's beforeAll opens this one.
const S3_TEST_PORT = 4569;
const BUCKET = "goto5x-media-test";

/**
 * The real Google OAuth/Drive endpoints are unreachable from this sandbox
 * (see google-drive-client.service.ts's disclosure) - so this spec overrides
 * DRIVE_CLIENT with a fake for the one call (/callback) that would otherwise
 * need Google's network, while exercising everything else - state signing/
 * verification, encryption at rest, revoke-then-reconnect, the security-event
 * audit trail - for real, against the real app, real Postgres, and real
 * Redis. This is a genuinely stronger test than a pure unit test of
 * DriveConnectionsService in isolation would be.
 */
describe("Google Drive connect/status/revoke (e2e, with a fake Google client) - SRS FR-9.1", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let fakeDriveClient: jest.Mocked<IDriveClient>;
  let s3: TestS3Server;

  beforeAll(async () => {
    s3 = await startTestS3Server(S3_TEST_PORT, BUCKET);
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);

    fakeDriveClient = {
      getAuthUrl: jest.fn().mockImplementation((state: string) => `https://accounts.google.com/fake-auth?state=${state}`),
      exchangeCodeForTokens: jest.fn().mockResolvedValue({
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
        expiresInSeconds: 3600,
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        accountEmail: "seller-drive-account@gmail.com",
      }),
      refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: "fake-access-token", expiresInSeconds: 3600 }),
      listImportableFiles: jest
        .fn()
        .mockResolvedValue([{ id: "drive-file-1", name: "vacation.jpg", mimeType: "image/jpeg" }]),
      downloadFile: jest.fn().mockResolvedValue({ buffer: Buffer.from("real-drive-bytes"), mimeType: "image/jpeg" }),
      revoke: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DRIVE_CLIENT)
      .useValue(fakeDriveClient)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
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

  async function signupAndLogin(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    return login.body.accessToken as string;
  }

  it("connect -> callback -> status: the connection is recorded and its email is visible, but no token value ever is", async () => {
    const token = await signupAndLogin("drive-owner@example.com");

    const connect = await request(app.getHttpServer())
      .get("/media/drive/connect")
      .set("Authorization", `Bearer ${token}`);
    expect(connect.status).toBe(200);
    expect(connect.body.authUrl).toContain("https://accounts.google.com/fake-auth?state=");
    const state = new URL(connect.body.authUrl).searchParams.get("state")!;

    const callback = await request(app.getHttpServer()).get("/media/drive/callback").query({ code: "fake-code", state });
    expect(callback.status).toBe(200);
    expect(callback.body.connected).toBe(true);
    expect(JSON.stringify(callback.body)).not.toContain("fake-refresh-token");

    const status = await request(app.getHttpServer())
      .get("/media/drive/connection")
      .set("Authorization", `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.googleAccountEmail).toBe("seller-drive-account@gmail.com");
    expect(status.body.status).toBe("active");
    expect(JSON.stringify(status.body)).not.toContain("fake-refresh-token");
    expect(status.body.refreshTokenEncrypted).toBeUndefined();

    const dbRow = await superuser.googleDriveConnection.findUniqueOrThrow({ where: { id: status.body.id } });
    expect(dbRow.refreshTokenEncrypted).not.toBe("fake-refresh-token"); // encrypted at rest, not the raw value
    expect(dbRow.refreshTokenEncrypted.length).toBeGreaterThan(0);
  });

  it("rejects a callback with an invalid or expired state", async () => {
    const callback = await request(app.getHttpServer())
      .get("/media/drive/callback")
      .query({ code: "fake-code", state: "not-a-real-signed-state" });
    expect(callback.status).toBe(400);
  });

  it("rejects a connect request without authentication", async () => {
    const res = await request(app.getHttpServer()).get("/media/drive/connect");
    expect(res.status).toBe(401);
  });

  it("revoke deletes the stored token, calls Google's revoke endpoint, and is audit-trailed", async () => {
    const token = await signupAndLogin("drive-revoke@example.com");
    const connect = await request(app.getHttpServer())
      .get("/media/drive/connect")
      .set("Authorization", `Bearer ${token}`);
    const state = new URL(connect.body.authUrl).searchParams.get("state")!;
    await request(app.getHttpServer()).get("/media/drive/callback").query({ code: "fake-code", state });

    const revoke = await request(app.getHttpServer())
      .delete("/media/drive/connection")
      .set("Authorization", `Bearer ${token}`);
    expect(revoke.status).toBe(200);
    expect(revoke.body.status).toBe("revoked");
    expect(fakeDriveClient.revoke).toHaveBeenCalledWith("fake-refresh-token");

    const user = await superuser.user.findUniqueOrThrow({ where: { email: "drive-revoke@example.com" } });
    const events = await superuser.userSecurityEvent.findMany({ where: { userId: user.id } });
    expect(events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining(["google_drive_connected", "google_drive_revoked"]),
    );

    const dbRow = await superuser.googleDriveConnection.findUniqueOrThrow({ where: { id: revoke.body.id } });
    expect(dbRow.refreshTokenEncrypted).toBe(""); // cleared, per the founder's "revoke = delete token" decision
  });

  it("revoking with no active connection returns 404", async () => {
    const token = await signupAndLogin("drive-norevoke@example.com");
    const revoke = await request(app.getHttpServer())
      .delete("/media/drive/connection")
      .set("Authorization", `Bearer ${token}`);
    expect(revoke.status).toBe(404);
  });

  it("end-to-end import: connect -> list files -> import -> a real media_assets row backed by real object storage (FR-9.1/FR-9.2)", async () => {
    const token = await signupAndLogin("drive-import@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Drive Import Store", slug: "drive-import-store" });

    const connect = await request(app.getHttpServer())
      .get("/media/drive/connect")
      .set("Authorization", `Bearer ${token}`);
    const state = new URL(connect.body.authUrl).searchParams.get("state")!;
    await request(app.getHttpServer()).get("/media/drive/callback").query({ code: "fake-code", state });

    const files = await request(app.getHttpServer())
      .get("/media/drive/files")
      .set("Authorization", `Bearer ${token}`);
    expect(files.status).toBe(200);
    expect(files.body).toEqual([{ id: "drive-file-1", name: "vacation.jpg", mimeType: "image/jpeg" }]);

    const importRes = await request(app.getHttpServer())
      .post(`/media/drive/stores/${store.body.id}/import`)
      .set("Authorization", `Bearer ${token}`)
      .send({ fileIds: ["drive-file-1"] });
    expect(importRes.status).toBe(201);
    expect(importRes.body.succeeded).toEqual([{ fileId: "drive-file-1", mediaAssetId: expect.any(String) }]);
    expect(importRes.body.failed).toEqual([]);

    const mediaAsset = await superuser.mediaAsset.findUniqueOrThrow({
      where: { id: importRes.body.succeeded[0].mediaAssetId },
    });
    expect(mediaAsset.source).toBe("google_drive_import");
    expect(mediaAsset.type).toBe("image");

    // Not just a DB row - prove the bytes genuinely landed in object storage,
    // same discipline as media.e2e-spec.ts's direct-upload test.
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3Client = new S3Client({
      endpoint: `http://localhost:${S3_TEST_PORT}`,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" },
    });
    const key = mediaAsset.url.split(`${BUCKET}/`)[1];
    const fetched = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await fetched.Body!.transformToByteArray();
    expect(Buffer.from(body).toString()).toBe("real-drive-bytes");
  });
});
