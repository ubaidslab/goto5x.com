import { INestApplication } from "@nestjs/common";
import { PrismaClient, StaffPermission, StaffScope } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, cookieHeaderFrom, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const STAFF_PASSWORD = "staff-horse-battery-9";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * D82 (`docs/auth-session-design.md`'s "Staff sub-account tokens" bullet)
 * - a staff login now creates a real SessionService session, so it's
 * genuinely revocable rather than a bare, non-revocable access token.
 * Same cookie-based refresh/logout/CSRF/reuse-detection pattern as
 * auth.e2e-spec.ts (D108) and admin-auth-refresh.e2e-spec.ts (D110) - see
 * either's own comment for why the cookie is captured and replayed by
 * hand rather than relying on supertest's own cookie jar.
 */
describe("Staff auth refresh (e2e) - D82 session revocability", () => {
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

  async function signupLoginAndCreateStore(email: string, slug: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${token}`).send({ name: `Store for ${email}`, slug });
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, sellerId: seller.id };
  }

  async function fullyVerifiedAdminToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  async function createAndLoginStaff(ownerToken: string, email: string) {
    await app.get(SettingsService).setValue("staff.max_accounts", "global", null, 5, ADMIN_ID);
    const scopePermissions: { scope: StaffScope; permission: StaffPermission }[] = [{ scope: "orders", permission: "write" }];
    const created = await request(app.getHttpServer())
      .post("/sellers/me/staff-accounts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email, password: STAFF_PASSWORD, scopePermissions });
    const login = await request(app.getHttpServer()).post("/staff/auth/login").send({ email, password: STAFF_PASSWORD });
    return {
      staffAccountId: created.body.id as string,
      accessToken: login.body.accessToken as string,
      sessionId: login.body.sessionId as string,
      cookie: cookieHeaderFrom(login.headers["set-cookie"]),
    };
  }

  it("a valid refresh token issues a new staff-shaped access token, rotating the session (not reusing it)", async () => {
    const { token: ownerToken } = await signupLoginAndCreateStore("staff-refresh-owner1@example.com", "staff-refresh-store1");
    const staff = await createAndLoginStaff(ownerToken, "staff-refresh-1@example.com");

    const refreshed = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeDefined();
    expect(refreshed.body.sessionId).not.toBe(staff.sessionId); // rotated, not reused

    // The new access token is genuinely usable against a staff-scoped route.
    const orders = await request(app.getHttpServer())
      .get("/stores")
      .set("Authorization", `Bearer ${refreshed.body.accessToken}`);
    expect(orders.status).not.toBe(401);
  });

  it("refresh-token rotation: the old session/refresh-token pair is dead after one refresh", async () => {
    const { token: ownerToken } = await signupLoginAndCreateStore("staff-refresh-owner2@example.com", "staff-refresh-store2");
    const staff = await createAndLoginStaff(ownerToken, "staff-refresh-2@example.com");

    const refresh1 = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refresh1.status).toBe(200);

    const refresh2 = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refresh2.status).toBe(401);
  });

  it("rejects a refresh attempt with no X-Requested-With header (CSRF defense)", async () => {
    const { token: ownerToken } = await signupLoginAndCreateStore("staff-refresh-owner-csrf@example.com", "staff-refresh-store-csrf");
    const staff = await createAndLoginStaff(ownerToken, "staff-refresh-csrf@example.com");

    const res = await request(app.getHttpServer()).post("/staff/auth/refresh").set("Cookie", staff.cookie);
    expect(res.status).toBe(403);
  });

  it("replaying an already-rotated-out staff refresh token revokes every session for that account and logs a platform event (D82 reuse detection)", async () => {
    const { token: ownerToken } = await signupLoginAndCreateStore("staff-refresh-owner3@example.com", "staff-refresh-store3");
    const staff = await createAndLoginStaff(ownerToken, "staff-refresh-3@example.com");

    const refresh1 = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refresh1.status).toBe(200);
    const refresh1Cookie = cookieHeaderFrom(refresh1.headers["set-cookie"]);

    // Replaying the original (now-rotated-out) cookie - reuse, not just "invalid".
    const replay = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(replay.status).toBe(401);

    // refresh1's own cookie, genuinely valid a moment ago, is now also dead.
    const afterReuse = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", refresh1Cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(afterReuse.status).toBe(401);

    const events = await superuser.platformEvent.findMany({
      where: { eventType: "staff_account.refresh_token_reuse_detected", actorId: staff.staffAccountId },
    });
    expect(events).toHaveLength(1);
  });

  it("logout destroys the session so its refresh token no longer works", async () => {
    const { token: ownerToken } = await signupLoginAndCreateStore("staff-refresh-owner4@example.com", "staff-refresh-store4");
    const staff = await createAndLoginStaff(ownerToken, "staff-refresh-4@example.com");

    const logout = await request(app.getHttpServer())
      .post("/staff/auth/logout")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(logout.status).toBe(204);

    const refresh = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refresh.status).toBe(401);
  });

  /**
   * The actual point of this whole feature: before this, a staff account
   * had no session to revoke at all, so an owner's/admin's action could
   * only ever block a FUTURE login - the current (already-issued) access
   * token kept working, unaffected, for up to its own full TTL regardless.
   */
  it("the owner revoking a staff account kills its live session immediately, not just future logins", async () => {
    const { token: ownerToken } = await signupLoginAndCreateStore("staff-refresh-owner5@example.com", "staff-refresh-store5");
    const staff = await createAndLoginStaff(ownerToken, "staff-refresh-5@example.com");

    const revoke = await request(app.getHttpServer())
      .delete(`/sellers/me/staff-accounts/${staff.staffAccountId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(revoke.status).toBe(200);

    const refreshAfterRevoke = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refreshAfterRevoke.status).toBe(401);
  });

  it("an admin suspending a staff account kills its live session immediately", async () => {
    const { token: ownerToken, sellerId } = await signupLoginAndCreateStore("staff-refresh-owner6@example.com", "staff-refresh-store6");
    const staff = await createAndLoginStaff(ownerToken, "staff-refresh-6@example.com");
    const adminToken = await fullyVerifiedAdminToken("staff-refresh-admin6@example.com");

    const until = new Date(Date.now() + 2 * DAY_MS).toISOString();
    const suspend = await request(app.getHttpServer())
      .post(`/admin/sellers/${sellerId}/staff-accounts/${staff.staffAccountId}/suspend`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ until, reason: "Suspected policy violation, under review" });
    expect(suspend.status).toBe(201);

    const refreshAfterSuspend = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refreshAfterSuspend.status).toBe(401);
  });

  it("an admin blocking a staff account kills its live session immediately", async () => {
    const { token: ownerToken, sellerId } = await signupLoginAndCreateStore("staff-refresh-owner7@example.com", "staff-refresh-store7");
    const staff = await createAndLoginStaff(ownerToken, "staff-refresh-7@example.com");
    const adminToken = await fullyVerifiedAdminToken("staff-refresh-admin7@example.com");

    const block = await request(app.getHttpServer())
      .post(`/admin/sellers/${sellerId}/staff-accounts/${staff.staffAccountId}/block`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Confirmed policy violation" });
    expect(block.status).toBe(201);

    const refreshAfterBlock = await request(app.getHttpServer())
      .post("/staff/auth/refresh")
      .set("Cookie", staff.cookie)
      .set("X-Requested-With", "XMLHttpRequest");
    expect(refreshAfterBlock.status).toBe(401);
  });
});
