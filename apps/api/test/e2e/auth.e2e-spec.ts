import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

describe("Auth flow (e2e) - SRS §14.0 signup/login checklist items", () => {
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

  it("signup -> verify-email -> login -> lands in an authenticated session", async () => {
    const signupRes = await request(app.getHttpServer()).post("/auth/signup").send({
      email: "founder@example.com",
      password: "correct-horse-battery",
      businessName: "Test Store",
    });
    expect(signupRes.status).toBe(201);
    expect(signupRes.body.userId).toBeDefined();

    const user = await superuser.user.findUniqueOrThrow({ where: { email: "founder@example.com" } });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.emailVerificationTokenHash).not.toBeNull();

    // The raw token is only ever known to the (mocked/console) email send in
    // this test - we recover it by regenerating from the stored hash's
    // matching plaintext is impossible by design, so instead we go through
    // the same code path the email would have used: read it back via a
    // dedicated test-only escape hatch is deliberately NOT provided (that
    // would defeat the point of hashing it). Instead this test verifies the
    // hash was stored, and a separate unit test (token.util.spec.ts) proves
    // hashToken(token) === tokenHash for a real generated token pair.
    // Here we simulate "the user clicked the emailed link" by minting the
    // same kind of token/hash pair and writing it directly, mirroring what
    // signup() did, to drive the rest of the flow deterministically.
    const { generateToken } = await import("../../src/auth/token.util");
    const { token, tokenHash } = generateToken();
    await superuser.user.update({ where: { id: user.id }, data: { emailVerificationTokenHash: tokenHash } });

    const verifyRes = await request(app.getHttpServer()).post("/auth/verify-email").send({ token });
    expect(verifyRes.status).toBe(200);

    const verifiedUser = await superuser.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(verifiedUser.emailVerifiedAt).not.toBeNull();
    expect(verifiedUser.emailVerificationTokenHash).toBeNull();

    const securityEvents = await superuser.userSecurityEvent.findMany({ where: { userId: user.id } });
    expect(securityEvents.some((e) => e.eventType === "email_verified")).toBe(true);

    const loginRes = await request(app.getHttpServer()).post("/auth/login").send({
      email: "founder@example.com",
      password: "correct-horse-battery",
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.sessionId).toBeDefined();

    // "lands in an authenticated session": the access token authorizes a
    // protected request.
    const storesRes = await request(app.getHttpServer())
      .get("/stores")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`);
    expect(storesRes.status).toBe(200);
    expect(storesRes.body).toEqual([]);
  });

  it("rejects login with the wrong password", async () => {
    await request(app.getHttpServer()).post("/auth/signup").send({
      email: "founder2@example.com",
      password: "correct-horse-battery",
      businessName: "Test Store 2",
    });
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "founder2@example.com", password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("refresh rotates the session and the old refresh token can't be reused", async () => {
    await request(app.getHttpServer()).post("/auth/signup").send({
      email: "founder3@example.com",
      password: "correct-horse-battery",
      businessName: "Test Store 3",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "founder3@example.com", password: "correct-horse-battery" });

    const refresh1 = await request(app.getHttpServer()).post("/auth/refresh").send({
      sessionId: login.body.sessionId,
      refreshToken: login.body.refreshToken,
    });
    expect(refresh1.status).toBe(200);

    // Old session/refresh token pair is dead after rotation.
    const refresh2 = await request(app.getHttpServer()).post("/auth/refresh").send({
      sessionId: login.body.sessionId,
      refreshToken: login.body.refreshToken,
    });
    expect(refresh2.status).toBe(401);
  });

  it("logout destroys the session so its refresh token no longer works", async () => {
    await request(app.getHttpServer()).post("/auth/signup").send({
      email: "founder4@example.com",
      password: "correct-horse-battery",
      businessName: "Test Store 4",
    });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "founder4@example.com", password: "correct-horse-battery" });

    await request(app.getHttpServer()).post("/auth/logout").send({ sessionId: login.body.sessionId });

    const refresh = await request(app.getHttpServer()).post("/auth/refresh").send({
      sessionId: login.body.sessionId,
      refreshToken: login.body.refreshToken,
    });
    expect(refresh.status).toBe(401);
  });

  it("rejects signup beyond the configured per-IP rate limit", async () => {
    await superuser.settingsValue.create({
      data: {
        definitionKey: "auth.signup_rate_limit_per_hour",
        scopeType: "global",
        scopeId: null,
        value: 2,
      },
    });

    const attempt = (n: number) =>
      request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: `rl${n}@example.com`, password: "correct-horse-battery", businessName: `RL ${n}` });

    expect((await attempt(1)).status).toBe(201);
    expect((await attempt(2)).status).toBe(201);
    expect((await attempt(3)).status).toBe(429);
  });
});
