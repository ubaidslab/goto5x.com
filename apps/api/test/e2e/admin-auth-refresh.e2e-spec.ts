import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Founder walkthrough finding (pre-Milestone-A, Phase 0.5) - "Unauthorized"
 * appearing on many admin pages for the actual account owner/admin traced
 * to a 15-minute access token with no refresh path at all for admin
 * sessions (unlike seller/supplier sessions, which already had
 * `POST /auth/refresh` - see auth.e2e-spec.ts's own refresh-rotation
 * tests, mirrored here for the new `POST /admin/auth/refresh`).
 */
describe("Admin auth refresh (e2e) - Phase 0.5 founder-walkthrough fix", () => {
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

  async function createAndLoginAdmin(email: string) {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body as { accessToken: string; sessionId: string; refreshToken: string };
  }

  it("a valid refresh token issues a new admin-shaped access token without re-prompting for MFA", async () => {
    const tokens = await createAndLoginAdmin("refresh-admin1@example.com");

    const refreshed = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .send({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeDefined();
    expect(refreshed.body.sessionId).not.toBe(tokens.sessionId); // rotated, not reused

    // The new access token is genuinely usable against an admin-only route.
    const search = await request(app.getHttpServer())
      .get("/admin/search?q=refresh-admin1")
      .set("Authorization", `Bearer ${refreshed.body.accessToken}`);
    expect(search.status).toBe(200);
  });

  it("refresh-token rotation: the old session/refresh-token pair is dead after one refresh", async () => {
    const tokens = await createAndLoginAdmin("refresh-admin2@example.com");

    const refresh1 = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .send({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken });
    expect(refresh1.status).toBe(200);

    const refresh2 = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .send({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken });
    expect(refresh2.status).toBe(401);
  });

  it("rejects a refresh attempt with an invalid refresh token", async () => {
    const tokens = await createAndLoginAdmin("refresh-admin3@example.com");

    const res = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .send({ sessionId: tokens.sessionId, refreshToken: "not-the-real-token" });
    expect(res.status).toBe(401);
  });
});
