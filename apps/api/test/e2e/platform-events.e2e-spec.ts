import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { DRIVE_CLIENT, IDriveClient } from "../../src/media/google-drive/drive-client.interface";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const S3_TEST_PORT = 4569; // must match .env.test's MINIO_ENDPOINT - see media.e2e-spec.ts's comment on why this is safe under --runInBand
const BUCKET = "goto5x-media-test";

/**
 * SRS §3.11/FR-26.x, §14.23 - proves the six lifecycle events backfilled
 * into Modules 1-3 are actually recorded, with no PII in `metadata`, and
 * that the table is genuinely immutable at the database grant level (same
 * discipline as `admin_audit_logs`, proven the same way in Module 1's own
 * tests).
 */
describe("Platform Event Log (e2e) - SRS §3.11/FR-26.x, §14.23", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let s3: TestS3Server;
  let fakeDriveClient: jest.Mocked<IDriveClient>;

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
        accountEmail: "events-drive-account@gmail.com",
      }),
      refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: "fake-access-token", expiresInSeconds: 3600 }),
      listImportableFiles: jest
        .fn()
        .mockResolvedValue([{ id: "drive-file-1", name: "vacation.jpg", mimeType: "image/jpeg" }]),
      downloadFile: jest.fn().mockResolvedValue({ buffer: Buffer.from("drive-bytes"), mimeType: "image/jpeg" }),
      revoke: jest.fn(),
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

  it("signup produces seller.signup, and creating a store produces store.created", async () => {
    const { storeId } = await signupLoginAndCreateStore("events-signup@example.com", "events-signup-store");

    const user = await superuser.user.findUniqueOrThrow({ where: { email: "events-signup@example.com" } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });

    const signupEvent = await superuser.platformEvent.findFirstOrThrow({ where: { eventType: "seller.signup" } });
    expect(signupEvent.actorType).toBe("seller");
    expect(signupEvent.actorId).toBe(seller.id);
    expect(signupEvent.entityType).toBe("seller");
    expect(signupEvent.entityId).toBe(seller.id);

    const storeEvent = await superuser.platformEvent.findFirstOrThrow({ where: { eventType: "store.created" } });
    expect(storeEvent.actorId).toBe(seller.id);
    expect(storeEvent.storeId).toBe(storeId);
    expect(storeEvent.entityId).toBe(storeId);
  });

  it("creating a product produces product.created", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("events-product@example.com", "events-product-store");
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Event-Tracked Widget" });

    const event = await superuser.platformEvent.findFirstOrThrow({ where: { eventType: "product.created" } });
    expect(event.storeId).toBe(storeId);
    expect(event.entityId).toBe(product.body.id);
  });

  it("a direct media upload produces media.imported with metadata.source = 'upload'", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("events-upload@example.com", "events-upload-store");
    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/media`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("photo-bytes"), { filename: "p.jpg", contentType: "image/jpeg" });

    const event = await superuser.platformEvent.findFirstOrThrow({ where: { eventType: "media.imported" } });
    expect(event.entityId).toBe(upload.body.id);
    expect(event.metadata).toEqual({ source: "upload" });
  });

  it("a Google Drive import produces media.imported with metadata.source = 'google_drive_import'", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("events-drive@example.com", "events-drive-store");
    const connect = await request(app.getHttpServer())
      .get("/media/drive/connect")
      .set("Authorization", `Bearer ${token}`);
    const state = new URL(connect.body.authUrl).searchParams.get("state")!;
    await request(app.getHttpServer()).get("/media/drive/callback").query({ code: "fake-code", state });

    const importRes = await request(app.getHttpServer())
      .post(`/media/drive/stores/${storeId}/import`)
      .set("Authorization", `Bearer ${token}`)
      .send({ fileIds: ["drive-file-1"] });

    const event = await superuser.platformEvent.findFirstOrThrow({ where: { eventType: "media.imported" } });
    expect(event.entityId).toBe(importRes.body.succeeded[0].mediaAssetId);
    expect(event.metadata).toEqual({ source: "google_drive_import" });
  });

  it("attaching and verifying a domain produce domain.attached and domain.verified", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("events-domain@example.com", "events-domain-store");
    // www.github.com's real CNAME (github.com) - same genuine-DNS proof as domains.e2e-spec.ts.
    await superuser.settingsValue.create({
      data: { definitionKey: "domains.cname_target", scopeType: "global", scopeId: null, value: "github.com" },
    });
    const attach = await request(app.getHttpServer())
      .post(`/stores/${storeId}/domains`)
      .set("Authorization", `Bearer ${token}`)
      .send({ domainName: "www.github.com" });

    const attachedEvent = await superuser.platformEvent.findFirstOrThrow({ where: { eventType: "domain.attached" } });
    expect(attachedEvent.storeId).toBe(storeId);
    expect(attachedEvent.entityId).toBe(attach.body.id);

    await request(app.getHttpServer())
      .post(`/stores/${storeId}/domains/${attach.body.id}/verify`)
      .set("Authorization", `Bearer ${token}`);

    const verifiedEvent = await superuser.platformEvent.findFirstOrThrow({ where: { eventType: "domain.verified" } });
    expect(verifiedEvent.actorType).toBe("system"); // no seller session in scope inside DomainVerificationService
    expect(verifiedEvent.entityId).toBe(attach.body.id);

    // Re-verifying an already-verified domain must not emit a second domain.verified row.
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/domains/${attach.body.id}/verify`)
      .set("Authorization", `Bearer ${token}`);
    const verifiedCount = await superuser.platformEvent.count({ where: { eventType: "domain.verified" } });
    expect(verifiedCount).toBe(1);
  });

  it("no metadata across any recorded event contains the seller's email (PII check, FR-26.4)", async () => {
    const email = "events-pii-check@example.com";
    const { token, storeId } = await signupLoginAndCreateStore(email, "events-pii-store");
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "PII Check Product" });

    const events = await superuser.platformEvent.findMany();
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(JSON.stringify(event.metadata)).not.toContain(email);
      expect(JSON.stringify(event.metadata)).not.toContain("events-pii-check");
    }
  });

  it("UPDATE/DELETE on platform_events fails at the database grant level, same as admin_audit_logs", async () => {
    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const row = await superuser.platformEvent.create({ data: { eventType: "test.immutability" } });

    await expect(
      runtime.$executeRawUnsafe(`UPDATE platform_events SET event_type = 'tampered' WHERE id = '${row.id}'`),
    ).rejects.toThrow();
    await expect(runtime.$executeRawUnsafe(`DELETE FROM platform_events WHERE id = '${row.id}'`)).rejects.toThrow();

    await runtime.$disconnect();
  });

  it("platform_events.retention_days resolves through the Settings Registry", async () => {
    const settingsService = app.get(SettingsService);
    await expect(settingsService.resolve<number>("platform_events.retention_days")).resolves.toBe(730);
  });
});
