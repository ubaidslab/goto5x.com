import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

describe("Settings Registry admin API + cache (e2e) - SRS §14.8", () => {
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

  async function fullyVerifiedAdminToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash("admin-password", 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });

    const login = await request(app.getHttpServer())
      .post("/admin/auth/login")
      .send({ email, password: "admin-password" });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken;
  }

  it("a settings write is visible to the very next resolve() call (cache invalidated, not just eventually consistent)", async () => {
    const token = await fullyVerifiedAdminToken("settingsadmin1@example.com");
    const settingsService = app.get(SettingsService);

    const before = await settingsService.resolve<number>("auth.password_reset_token_ttl_minutes");
    expect(before).toBe(45); // seeded default

    const write = await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${token}`)
      .send({ key: "auth.password_reset_token_ttl_minutes", scopeType: "global", value: 99 });
    expect(write.status).toBe(200);

    const after = await settingsService.resolve<number>("auth.password_reset_token_ttl_minutes");
    expect(after).toBe(99);
  });

  it("rejects an out-of-range value before it reaches the database", async () => {
    const token = await fullyVerifiedAdminToken("settingsadmin2@example.com");

    const res = await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${token}`)
      .send({ key: "auth.password_reset_token_ttl_minutes", scopeType: "global", value: 999999 });
    expect(res.status).toBe(400);

    const row = await superuser.settingsValue.findFirst({
      where: { definitionKey: "auth.password_reset_token_ttl_minutes", scopeType: "global" },
    });
    expect(row).toBeNull();
  });

  it("every settings write is captured in the audit log with before/after values", async () => {
    const token = await fullyVerifiedAdminToken("settingsadmin3@example.com");

    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${token}`)
      .send({ key: "auth.password_reset_token_ttl_minutes", scopeType: "global", value: 60 });

    const logs = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${token}`);
    const entry = logs.body.find((l: any) => l.action === "settings.update");
    expect(entry).toBeDefined();
    expect(entry.afterValue).toBe(60);
  });

  it("non-admin (seller) sessions cannot reach the settings admin API", async () => {
    await request(app.getHttpServer()).post("/auth/signup").send({ agreementAccepted: true,
      email: "notanadmin@example.com",
      password: "correct-horse-battery",
      businessName: "Not Admin",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "notanadmin@example.com", password: "correct-horse-battery" });

    const res = await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ key: "auth.password_reset_token_ttl_minutes", scopeType: "global", value: 60 });
    expect(res.status).toBe(403);
  });
});
