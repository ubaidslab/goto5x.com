import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

describe("Admin auth + MFA + audit log (e2e) - SRS FR-8.9/FR-8.12, §14.8/§14.12", () => {
  let app: INestApplication;
  let superuser: PrismaClient;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
  });

  afterEach(async () => {
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
  });

  async function createAdmin(email: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    const adminUser = await superuser.adminUser.create({
      data: { userId: user.id, role: "super_admin", mfaEnabled: false },
    });
    return { user, adminUser };
  }

  it("using an admin account without completing MFA enrollment cannot reach a protected admin endpoint", async () => {
    await createAdmin("admin1@example.com", "admin-password-1");

    const login = await request(app.getHttpServer())
      .post("/admin/auth/login")
      .send({ email: "admin1@example.com", password: "admin-password-1" });
    expect(login.status).toBe(200);
    expect(login.body.mfaEnrolled).toBe(false);

    // No MFA-verified access token exists yet - there is no code path that
    // reaches a protected admin endpoint from just email+password.
    const guess = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${login.body.preAuthToken}`);
    expect(guess.status).toBe(403);
  });

  it("first-login MFA enrollment -> verify -> issues a fully-verified session that can reach admin endpoints", async () => {
    await createAdmin("admin2@example.com", "admin-password-2");

    const login = await request(app.getHttpServer())
      .post("/admin/auth/login")
      .send({ email: "admin2@example.com", password: "admin-password-2" });

    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    expect(enroll.status).toBe(200);
    expect(enroll.body.secret).toBeDefined();

    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeDefined();

    const auditLogs = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${verify.body.accessToken}`);
    expect(auditLogs.status).toBe(200);
    expect(auditLogs.body.some((e: any) => e.action === "admin.login")).toBe(true);
  });

  it("rejects an invalid MFA code", async () => {
    await createAdmin("admin3@example.com", "admin-password-3");
    const login = await request(app.getHttpServer())
      .post("/admin/auth/login")
      .send({ email: "admin3@example.com", password: "admin-password-3" });
    await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });

    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code: "000000" });
    expect(verify.status).toBe(401);
  });

  it("rejects admin login beyond the configured per-account rate limit (Module 21, §14.12 rate-limit audit)", async () => {
    await createAdmin("admin-rl@example.com", "admin-password-rl");
    await superuser.settingsValue.create({
      data: {
        definitionKey: "auth.login_rate_limit_per_hour",
        scopeType: "global",
        scopeId: null,
        value: 2,
      },
    });

    const attempt = () =>
      request(app.getHttpServer())
        .post("/admin/auth/login")
        .send({ email: "admin-rl@example.com", password: "wrong-password" });

    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
  });

  it("audit log is immutable at the database grant level, not just the application layer", async () => {
    const { adminUser } = await createAdmin("admin4@example.com", "admin-password-4");
    const log = await superuser.adminAuditLog.create({
      data: { adminUserId: adminUser.id, action: "test.action", targetType: "test", targetId: null },
    });

    // Connect as the actual runtime role the application uses day to day -
    // this must fail even though we're not going through any application
    // code, because the grant itself forbids it.
    const runtimeOnly = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await expect(
      runtimeOnly.$executeRawUnsafe(`UPDATE admin_audit_logs SET action = 'tampered' WHERE id = '${log.id}'`),
    ).rejects.toThrow();
    await expect(
      runtimeOnly.$executeRawUnsafe(`DELETE FROM admin_audit_logs WHERE id = '${log.id}'`),
    ).rejects.toThrow();
    await runtimeOnly.$disconnect();

    const stillThere = await superuser.adminAuditLog.findUnique({ where: { id: log.id } });
    expect(stillThere?.action).toBe("test.action");
  });
});
