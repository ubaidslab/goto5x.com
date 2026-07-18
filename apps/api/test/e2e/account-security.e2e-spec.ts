import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

describe("Seller Account Security: 2FA + Devices (e2e) - SRS §5.25, §14.24", () => {
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

  async function signup(email: string): Promise<{ sellerId: string; userId: string }> {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { sellerId: seller.id, userId: user.id };
  }

  async function login(email: string, userAgent = "test-agent") {
    return request(app.getHttpServer()).post("/auth/login").set("User-Agent", userAgent).send({ email, password: PASSWORD });
  }

  // SRS FR-25.6's own text scopes this key to global/plan only (no seller
  // scope) - a global override affects every seller in the test, which is
  // fine given resetDatabase()/afterEach isolation.
  async function setEnforcementMode(mode: string) {
    await superuser.settingsValue.create({
      data: { definitionKey: "auth.seller_mfa_enforcement", scopeType: "global", scopeId: null, value: mode },
    });
  }

  describe("TOTP 2FA (FR-25.6)", () => {
    it("optional (default) mode never blocks login without 2FA", async () => {
      await signup("mfa-optional@example.com");
      const res = await login("mfa-optional@example.com");
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.preAuthToken).toBeUndefined();
    });

    it("required_always mode blocks login itself (no code) and requires enrollment + verification to complete it", async () => {
      await signup("mfa-required@example.com");
      await setEnforcementMode("required_always");

      const preAuth = await login("mfa-required@example.com");
      expect(preAuth.status).toBe(200);
      expect(preAuth.body.preAuthToken).toBeDefined();
      expect(preAuth.body.mfaEnrolled).toBe(false);
      expect(preAuth.body.accessToken).toBeUndefined();

      const enroll = await request(app.getHttpServer())
        .post("/auth/mfa/enroll")
        .send({ preAuthToken: preAuth.body.preAuthToken });
      expect(enroll.status).toBe(200);
      expect(enroll.body.secret).toBeDefined();

      const badCode = await request(app.getHttpServer())
        .post("/auth/mfa/verify")
        .send({ preAuthToken: preAuth.body.preAuthToken, code: "000000" });
      expect(badCode.status).toBe(401);

      const goodCode = authenticator.generate(enroll.body.secret);
      const verify = await request(app.getHttpServer())
        .post("/auth/mfa/verify")
        .send({ preAuthToken: preAuth.body.preAuthToken, code: goodCode });
      expect(verify.status).toBe(200);
      expect(verify.body.accessToken).toBeDefined();
    });

    it("an already-enrolled seller always steps through the code on every future login, regardless of enforcement mode", async () => {
      await signup("mfa-sticky@example.com");
      await setEnforcementMode("required_always");
      const preAuth = await login("mfa-sticky@example.com");
      const enroll = await request(app.getHttpServer())
        .post("/auth/mfa/enroll")
        .send({ preAuthToken: preAuth.body.preAuthToken });
      const goodCode = authenticator.generate(enroll.body.secret);
      await request(app.getHttpServer())
        .post("/auth/mfa/verify")
        .send({ preAuthToken: preAuth.body.preAuthToken, code: goodCode });

      // Switch back to "optional" via the real service (invalidates the
      // Settings Registry cache, unlike a raw DB write) - an already-
      // enrolled seller must still be asked for the code.
      const settingsService = app.get(SettingsService);
      await settingsService.setValue(
        "auth.seller_mfa_enforcement",
        "global",
        null,
        "optional",
        "00000000-0000-0000-0000-000000000000",
      );
      const secondLogin = await login("mfa-sticky@example.com");
      expect(secondLogin.body.preAuthToken).toBeDefined();
      expect(secondLogin.body.mfaEnrolled).toBe(true);
    });
  });

  describe("Voluntary 2FA opt-in under `optional` enforcement (FR-25.6)", () => {
    it("an already-logged-in seller can enroll and verify 2FA on their own initiative, then is asked for the code on their next login", async () => {
      await signup("mfa-voluntary@example.com");
      const loggedIn = await login("mfa-voluntary@example.com");
      expect(loggedIn.body.accessToken).toBeDefined(); // optional mode - normal single-step login

      const enroll = await request(app.getHttpServer())
        .post("/sellers/me/mfa/enroll")
        .set("Authorization", `Bearer ${loggedIn.body.accessToken}`);
      expect(enroll.status).toBe(201);
      expect(enroll.body.secret).toBeDefined();

      const badCode = await request(app.getHttpServer())
        .post("/sellers/me/mfa/verify")
        .set("Authorization", `Bearer ${loggedIn.body.accessToken}`)
        .send({ code: "000000" });
      expect(badCode.status).toBe(401);

      const goodCode = authenticator.generate(enroll.body.secret);
      const verify = await request(app.getHttpServer())
        .post("/sellers/me/mfa/verify")
        .set("Authorization", `Bearer ${loggedIn.body.accessToken}`)
        .send({ code: goodCode });
      expect(verify.status).toBe(201);

      const profile = await request(app.getHttpServer())
        .get("/sellers/me")
        .set("Authorization", `Bearer ${loggedIn.body.accessToken}`);
      expect(profile.body.mfaEnabled).toBe(true);

      const nextLogin = await login("mfa-voluntary@example.com");
      expect(nextLogin.body.preAuthToken).toBeDefined();
      expect(nextLogin.body.mfaEnrolled).toBe(true);
    });
  });

  describe("Session/device management (FR-25.7)", () => {
    it("lists every active session with correct device label/IP data; revoking one ends only that session", async () => {
      await signup("sessions@example.com");
      const chrome = await login("sessions@example.com", "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36");
      const firefox = await login("sessions@example.com", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) Firefox/121.0");

      const list = await request(app.getHttpServer())
        .get("/sellers/me/sessions")
        .set("Authorization", `Bearer ${chrome.body.accessToken}`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(2);
      expect(list.body.some((s: { deviceLabel: string }) => s.deviceLabel === "Chrome on Windows")).toBe(true);
      expect(list.body.some((s: { deviceLabel: string }) => s.deviceLabel === "Firefox on macOS")).toBe(true);

      const revoke = await request(app.getHttpServer())
        .delete(`/sellers/me/sessions/${chrome.body.sessionId}`)
        .set("Authorization", `Bearer ${firefox.body.accessToken}`);
      expect(revoke.status).toBe(200);

      const refreshRevoked = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ sessionId: chrome.body.sessionId, refreshToken: chrome.body.refreshToken });
      expect(refreshRevoked.status).toBe(401);

      const refreshStillActive = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ sessionId: firefox.body.sessionId, refreshToken: firefox.body.refreshToken });
      expect(refreshStillActive.status).toBe(200);
    });

    it("cannot revoke another seller's session", async () => {
      await signup("owner@example.com");
      const owner = await login("owner@example.com");
      await signup("intruder@example.com");
      const intruder = await login("intruder@example.com");

      const res = await request(app.getHttpServer())
        .delete(`/sellers/me/sessions/${owner.body.sessionId}`)
        .set("Authorization", `Bearer ${intruder.body.accessToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("Concurrent-device limit (FR-25.7)", () => {
    it("resolves auth.max_concurrent_devices with seller > global precedence; rejects a login beyond the limit with a clear reason, without evicting an existing session", async () => {
      await superuser.settingsValue.create({
        data: { definitionKey: "auth.max_concurrent_devices", scopeType: "global", scopeId: null, value: 2 },
      });
      await signup("device-limit@example.com");

      const first = await login("device-limit@example.com");
      expect(first.status).toBe(200);
      const second = await login("device-limit@example.com");
      expect(second.status).toBe(200);

      const third = await login("device-limit@example.com");
      expect(third.status).toBe(403);
      // HttpExceptionFilter passes exception.getResponse() through as
      // `message` verbatim - for a plain-string ForbiddenException, Nest's
      // own HttpException shape nests the string one level deeper
      // ({statusCode, error, message}), same as every other plain-string
      // exception in this codebase (e.g. store-suspended checks elsewhere
      // assert against this same nested shape via toMatchObject).
      expect(third.body.message.message).toMatch(/device limit/i);

      // The two existing sessions are unaffected - not silently evicted.
      const stillWorks = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ sessionId: first.body.sessionId, refreshToken: first.body.refreshToken });
      expect(stillWorks.status).toBe(200);
    });

    it("a seller-scoped override raises only that one seller's limit, leaving other sellers on the same plan unaffected", async () => {
      await superuser.settingsValue.create({
        data: { definitionKey: "auth.max_concurrent_devices", scopeType: "global", scopeId: null, value: 1 },
      });
      const { sellerId } = await signup("extra-slots@example.com");
      await signup("normal-slots@example.com");

      await superuser.settingsValue.create({
        data: { definitionKey: "auth.max_concurrent_devices", scopeType: "seller", scopeId: sellerId, value: 3 },
      });

      // The overridden seller can log in twice (limit 3), the other is capped at 1.
      const first = await login("extra-slots@example.com");
      expect(first.status).toBe(200);
      const second = await login("extra-slots@example.com");
      expect(second.status).toBe(200);

      const normalFirst = await login("normal-slots@example.com");
      expect(normalFirst.status).toBe(200);
      const normalSecond = await login("normal-slots@example.com");
      expect(normalSecond.status).toBe(403);
    });
  });
});
