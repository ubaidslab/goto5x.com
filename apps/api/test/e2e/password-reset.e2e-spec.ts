import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

describe("Password reset (e2e) - SRS FR-25.1-25.4 / §14.0 checklist items", () => {
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

  async function signupAndLogin(email: string, password: string) {
    await request(app.getHttpServer()).post("/auth/signup").send({ agreementAccepted: true, email, password, businessName: "PR Test" });
    return request(app.getHttpServer()).post("/auth/login").send({ email, password });
  }

  it("end-to-end: request -> complete with the emailed token -> old sessions invalidated -> new password works", async () => {
    const login = await signupAndLogin("reset1@example.com", "original-password-1");
    expect(login.status).toBe(200);

    await request(app.getHttpServer())
      .post("/auth/password-reset/request")
      .send({ email: "reset1@example.com" });

    const user = await superuser.user.findUniqueOrThrow({ where: { email: "reset1@example.com" } });
    expect(user.passwordResetTokenHash).not.toBeNull();

    const { generateToken } = await import("../../src/auth/token.util");
    const { token, tokenHash } = generateToken();
    await superuser.user.update({ where: { id: user.id }, data: { passwordResetTokenHash: tokenHash } });

    const complete = await request(app.getHttpServer())
      .post("/auth/password-reset/complete")
      .send({ token, newPassword: "brand-new-password-1" });
    expect(complete.status).toBe(200);

    // Old session is dead.
    const refreshOld = await request(app.getHttpServer()).post("/auth/refresh").send({
      sessionId: login.body.sessionId,
      refreshToken: login.body.refreshToken,
    });
    expect(refreshOld.status).toBe(401);

    // Old password no longer works; new one does.
    const loginOld = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "reset1@example.com", password: "original-password-1" });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "reset1@example.com", password: "brand-new-password-1" });
    expect(loginNew.status).toBe(200);

    const events = await superuser.userSecurityEvent.findMany({ where: { userId: user.id } });
    expect(events.some((e) => e.eventType === "password_reset_requested")).toBe(true);
    expect(events.some((e) => e.eventType === "password_reset_completed")).toBe(true);
  });

  it("rejects an expired reset token", async () => {
    await signupAndLogin("reset2@example.com", "original-password-2");
    const user = await superuser.user.findUniqueOrThrow({ where: { email: "reset2@example.com" } });

    const { generateToken } = await import("../../src/auth/token.util");
    const { token, tokenHash } = generateToken();
    await superuser.user.update({
      where: { id: user.id },
      data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app.getHttpServer())
      .post("/auth/password-reset/complete")
      .send({ token, newPassword: "does-not-matter-1" });
    expect(res.status).toBe(400);
  });

  it("rejects reusing an already-completed (single-use) reset token", async () => {
    await signupAndLogin("reset3@example.com", "original-password-3");
    const user = await superuser.user.findUniqueOrThrow({ where: { email: "reset3@example.com" } });

    const { generateToken } = await import("../../src/auth/token.util");
    const { token, tokenHash } = generateToken();
    await superuser.user.update({
      where: { id: user.id },
      data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: new Date(Date.now() + 60_000) },
    });

    const first = await request(app.getHttpServer())
      .post("/auth/password-reset/complete")
      .send({ token, newPassword: "brand-new-password-3" });
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .post("/auth/password-reset/complete")
      .send({ token, newPassword: "another-new-password-3" });
    expect(second.status).toBe(400);
  });

  it("returns the same generic response for an existing vs. non-existent email (no account enumeration)", async () => {
    await signupAndLogin("reset4@example.com", "original-password-4");

    const existing = await request(app.getHttpServer())
      .post("/auth/password-reset/request")
      .send({ email: "reset4@example.com" });
    const nonExistent = await request(app.getHttpServer())
      .post("/auth/password-reset/request")
      .send({ email: "no-such-account@example.com" });

    expect(existing.status).toBe(nonExistent.status);
    expect(existing.body).toEqual(nonExistent.body);
  });

  it("rate-limits repeated reset requests for the same account", async () => {
    await signupAndLogin("reset5@example.com", "original-password-5");
    await superuser.settingsValue.create({
      data: {
        definitionKey: "auth.password_reset_rate_limit_per_hour",
        scopeType: "global",
        scopeId: null,
        value: 2,
      },
    });

    const attempt = () =>
      request(app.getHttpServer()).post("/auth/password-reset/request").send({ email: "reset5@example.com" });

    expect((await attempt()).status).toBe(200);
    expect((await attempt()).status).toBe(200);
    expect((await attempt()).status).toBe(429);
  });
});
