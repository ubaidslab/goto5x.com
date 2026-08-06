import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const S3_TEST_PORT = 4569;
const BUCKET = "uzeyn-media-test";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/** Module 22 Phase B (SRS §5.33, FR-33.8, checklist §14.33's Careers line) - fully independent of Phase A's referral engine. */
describe("Careers (e2e) - SRS §5.33 FR-33.8", () => {
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

  async function createAndLoginAdmin(email: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  it("only `open` postings are publicly listed", async () => {
    const adminToken = await createAndLoginAdmin("careers-admin-1@example.com");
    const draft = await request(app.getHttpServer())
      .post("/admin/careers/postings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "Draft Role", description: "Not visible yet." });
    const open = await request(app.getHttpServer())
      .post("/admin/careers/postings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "Open Role", description: "Visible." });
    await request(app.getHttpServer())
      .patch(`/admin/careers/postings/${open.body.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "open" });

    const publicList = await request(app.getHttpServer()).get("/careers");
    expect(publicList.status).toBe(200);
    const ids = publicList.body.map((p: { id: string }) => p.id);
    expect(ids).toContain(open.body.id);
    expect(ids).not.toContain(draft.body.id);
  });

  it("a candidate can apply with a CV upload within the configured size/type limit; an admin sees the pipeline; no public endpoint exposes applicant data", async () => {
    const adminToken = await createAndLoginAdmin("careers-admin-2@example.com");
    const posting = await request(app.getHttpServer())
      .post("/admin/careers/postings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "Backend Engineer", description: "Node/NestJS." });
    await request(app.getHttpServer())
      .patch(`/admin/careers/postings/${posting.body.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "open" });

    // A wrong-type file is rejected with a clear error, never silently accepted.
    const wrongType = await request(app.getHttpServer())
      .post(`/careers/${posting.body.id}/apply`)
      .field("applicantName", "Ayesha Khan")
      .field("applicantEmail", "ayesha@example.com")
      .attach("cv", Buffer.from("not a real cv"), { filename: "cv.exe", contentType: "application/x-msdownload" });
    expect(wrongType.status).toBe(400);

    // A real PDF succeeds.
    const apply = await request(app.getHttpServer())
      .post(`/careers/${posting.body.id}/apply`)
      .field("applicantName", "Ayesha Khan")
      .field("applicantEmail", "ayesha@example.com")
      .field("applicantPhone", "03001234567")
      .attach("cv", Buffer.from("%PDF-1.4 fake cv content"), { filename: "cv.pdf", contentType: "application/pdf" });
    expect(apply.status).toBe(201);
    expect(apply.body.status).toBe("received");
    expect(apply.body.cvUrl).toBeTruthy();

    // The public listing endpoint never exposes applicant contact details or CVs.
    const publicList = await request(app.getHttpServer()).get("/careers");
    expect(JSON.stringify(publicList.body)).not.toContain("ayesha@example.com");
    expect(JSON.stringify(publicList.body)).not.toContain("Ayesha Khan");

    // The admin pipeline shows it, with a status label (not the raw enum value).
    const pipeline = await request(app.getHttpServer())
      .get(`/admin/careers/postings/${posting.body.id}/applications`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(pipeline.status).toBe(200);
    expect(pipeline.body).toHaveLength(1);
    expect(pipeline.body[0].applicantEmail).toBe("ayesha@example.com");
    expect(pipeline.body[0].statusLabel).toBe("Received");

    const advance = await request(app.getHttpServer())
      .patch(`/admin/careers/applications/${apply.body.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "interviewing" });
    expect(advance.status).toBe(200);
    expect(advance.body.status).toBe("interviewing");
  });

  it("a closed posting rejects new applications", async () => {
    const adminToken = await createAndLoginAdmin("careers-admin-3@example.com");
    const posting = await request(app.getHttpServer())
      .post("/admin/careers/postings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "Closed Role", description: "Not accepting." });
    // Never opened - stays `draft`.
    const apply = await request(app.getHttpServer())
      .post(`/careers/${posting.body.id}/apply`)
      .field("applicantName", "Bilal Ahmed")
      .field("applicantEmail", "bilal@example.com")
      .attach("cv", Buffer.from("%PDF-1.4 fake cv content"), { filename: "cv.pdf", contentType: "application/pdf" });
    expect(apply.status).toBe(400);
  });
});
