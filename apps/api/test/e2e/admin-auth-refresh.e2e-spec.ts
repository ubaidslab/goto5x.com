import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, cookieHeaderFrom, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

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

  // D82 admin slice - the refresh token now travels as a
  // __Host-admin_refresh_token cookie (HttpOnly, Secure, SameSite=Lax),
  // never in the request/response body - same reasoning and the same
  // manual-cookie-capture pattern as auth.e2e-spec.ts's own D82 tests
  // (supertest's agent() won't replay a Secure cookie over its plain-HTTP
  // test transport).
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
    return { ...verify.body, cookie: cookieHeaderFrom(verify.headers["set-cookie"]) } as { accessToken: string; sessionId: string; cookie: string };
  }

  it("a valid refresh token issues a new admin-shaped access token without re-prompting for MFA", async () => {
    const tokens = await createAndLoginAdmin("refresh-admin1@example.com");

    const refreshed = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .set("Cookie", tokens.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
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
      .set("Cookie", tokens.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refresh1.status).toBe(200);

    const refresh2 = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .set("Cookie", tokens.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refresh2.status).toBe(401);
  });

  it("rejects a refresh attempt with an invalid refresh token", async () => {
    await createAndLoginAdmin("refresh-admin3@example.com");

    const res = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .set("Cookie", "__Host-admin_refresh_token=not-a-real-session%3Anot-the-real-token")
      .set("X-Requested-With", "XMLHttpRequest");
    expect(res.status).toBe(401);
  });

  it("rejects a refresh attempt with no X-Requested-With header (CSRF defense)", async () => {
    const tokens = await createAndLoginAdmin("refresh-admin-csrf@example.com");

    const res = await request(app.getHttpServer()).post("/admin/auth/refresh").set("Cookie", tokens.cookie);
    expect(res.status).toBe(403);
  });

  it("replaying an already-rotated-out admin refresh token revokes every session for that admin and logs a security event (D82 reuse detection)", async () => {
    const tokens = await createAndLoginAdmin("refresh-admin4@example.com");
    const user = await superuser.user.findUniqueOrThrow({ where: { email: "refresh-admin4@example.com" } });

    const refresh1 = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .set("Cookie", tokens.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refresh1.status).toBe(200);
    const refresh1Cookie = cookieHeaderFrom(refresh1.headers["set-cookie"]);

    // Replaying the original (now-rotated-out) cookie - reuse, not just "invalid".
    const replay = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .set("Cookie", tokens.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(replay.status).toBe(401);

    // refresh1's own cookie, genuinely valid a moment ago, is now also dead -
    // the whole account's sessions were revoked, not just the replayed one.
    const afterReuse = await request(app.getHttpServer())
      .post("/admin/auth/refresh")
      .set("Cookie", refresh1Cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(afterReuse.status).toBe(401);

    const events = await superuser.userSecurityEvent.findMany({
      where: { userId: user.id, eventType: "refresh_token_reuse_detected" },
    });
    expect(events).toHaveLength(1);
  });

  /**
   * D82 - stricter admin lifetimes. JWT_REFRESH_TTL_DAYS is 30 in every
   * env this project ships (seller default); ADMIN_JWT_REFRESH_TTL_DAYS
   * is deliberately unset here (and in CI), so this proves the admin
   * cookie actually falls back to its own much-shorter strict default
   * (ADMIN_DEFAULT_REFRESH_TTL_DAYS = 1 day = 86400s) rather than quietly
   * inheriting the seller-wide value.
   */
  it("the admin refresh cookie's Max-Age reflects the strict admin default, not the (far longer) seller-wide JWT_REFRESH_TTL_DAYS", async () => {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email: "refresh-admin-ttl@example.com", passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email: "refresh-admin-ttl@example.com", password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });

    const rawSetCookie = verify.headers["set-cookie"];
    const raw = Array.isArray(rawSetCookie) ? rawSetCookie[0] : rawSetCookie;
    const maxAgeMatch = /Max-Age=(\d+)/i.exec(raw ?? "");
    expect(maxAgeMatch).not.toBeNull();
    const maxAgeSeconds = Number(maxAgeMatch![1]);
    expect(maxAgeSeconds).toBe(24 * 60 * 60); // exactly 1 day, the strict default
    expect(maxAgeSeconds).toBeLessThan(30 * 24 * 60 * 60); // nowhere near JWT_REFRESH_TTL_DAYS=30
  });
});
