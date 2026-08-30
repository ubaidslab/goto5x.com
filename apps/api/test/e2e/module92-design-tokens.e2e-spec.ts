import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { DESIGN_TOKENS } from "../../src/design-tokens/design-tokens.constants";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const ADMIN_PASSWORD = "correct-horse-battery";

/**
 * Module 92 (SRS §5.68/FR-68.1-68.5) - admin-configurable, lockable brand
 * color tokens. Covers what a unit test on SettingsService alone can't:
 * the real seeded definitions, the public unauthenticated read endpoint,
 * the admin aggregate view, the AdminAuthGuard gate, and - the module's
 * whole reason for existing - that a locked value genuinely cannot be
 * changed until explicitly unlocked.
 */
describe("Admin-configurable, lockable brand color tokens (e2e) - SRS §5.68", () => {
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

  async function createAndLoginAdmin(email: string): Promise<{ token: string }> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return { token: verify.body.accessToken as string };
  }

  describe("FR-68.1/68.2: seeded definitions", () => {
    it("registers all 13 core tokens as global-scope-only, color-typed, high-impact definitions", async () => {
      const admin = await createAndLoginAdmin("design-tokens-defs@example.com");
      const res = await request(app.getHttpServer()).get("/admin/settings/definitions").set("Authorization", `Bearer ${admin.token}`);
      const colorDefs = (res.body as Array<{ key: string; valueType: string; allowedScopes: string[]; requiresConfirmation: boolean }>).filter(
        (d) => d.key.startsWith("design.color."),
      );
      expect(colorDefs).toHaveLength(DESIGN_TOKENS.length);
      for (const def of colorDefs) {
        expect(def.valueType).toBe("color");
        expect(def.allowedScopes).toEqual(["global"]);
        expect(def.requiresConfirmation).toBe(true);
      }
    });

    it("rejects a non-hex value for a color-typed key", async () => {
      const admin = await createAndLoginAdmin("design-tokens-badhex@example.com");
      const res = await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", value: "not-a-color" });
      expect(res.status).toBe(400);
    });
  });

  describe("FR-68.4: public, unauthenticated GET /design-tokens", () => {
    it("returns an empty object when nothing is overridden", async () => {
      const res = await request(app.getHttpServer()).get("/design-tokens");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it("returns only the overridden token, mapped to its real CSS variable name, once an admin sets one - no auth header sent", async () => {
      const admin = await createAndLoginAdmin("design-tokens-public@example.com");
      await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", value: "#123456" });

      const res = await request(app.getHttpServer()).get("/design-tokens");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ "--color-accent": "#123456" });
    });
  });

  describe("FR-68.5: admin aggregate view", () => {
    it("reflects effectiveValue/hasOverride/locked correctly before and after a write", async () => {
      const admin = await createAndLoginAdmin("design-tokens-aggregate@example.com");

      const before = await request(app.getHttpServer()).get("/admin/design-tokens").set("Authorization", `Bearer ${admin.token}`);
      const inkBefore = (before.body as Array<any>).find((t) => t.key === "design.color.ink");
      expect(inkBefore.hasOverride).toBe(false);
      expect(inkBefore.locked).toBe(false);
      expect(inkBefore.effectiveValue).toBe(inkBefore.defaultValue);

      await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.ink", scopeType: "global", value: "#111111" });

      const after = await request(app.getHttpServer()).get("/admin/design-tokens").set("Authorization", `Bearer ${admin.token}`);
      const inkAfter = (after.body as Array<any>).find((t) => t.key === "design.color.ink");
      expect(inkAfter.hasOverride).toBe(true);
      expect(inkAfter.effectiveValue).toBe("#111111");
    });

    it("rejects an unauthenticated request", async () => {
      const res = await request(app.getHttpServer()).get("/admin/design-tokens");
      expect(res.status).toBe(401);
    });
  });

  describe("FR-68.3: locking", () => {
    it("a locked token rejects a value write with 409, regardless of who's writing", async () => {
      const admin = await createAndLoginAdmin("design-tokens-lock1@example.com");

      const lock = await request(app.getHttpServer())
        .put("/admin/settings/values/lock")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", locked: true });
      expect(lock.status).toBe(200);
      expect(lock.body.locked).toBe(true);
      // Locking with no prior override pins the current effective (default)
      // value as an explicit global override - "locked" is never ambiguous
      // about what value it's locked at.
      expect(lock.body.value).toBe(DESIGN_TOKENS.find((t) => t.key === "design.color.accent")!.defaultValue);

      const blockedWrite = await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", value: "#654321" });
      expect(blockedWrite.status).toBe(409);
      expect(blockedWrite.body.message.message).toMatch(/locked/i);

      // The public endpoint must still reflect the pinned (unchanged) value -
      // the rejected write never took effect anywhere.
      const publicRead = await request(app.getHttpServer()).get("/design-tokens");
      expect(publicRead.body["--color-accent"]).toBeUndefined(); // pinned value equals default, so it's not "overridden" from a consumer's perspective
    });

    it("unlocking allows a write to succeed again", async () => {
      const admin = await createAndLoginAdmin("design-tokens-lock2@example.com");

      await request(app.getHttpServer())
        .put("/admin/settings/values/lock")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", locked: true });

      const stillBlocked = await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", value: "#abcdef" });
      expect(stillBlocked.status).toBe(409);

      const unlock = await request(app.getHttpServer())
        .put("/admin/settings/values/lock")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", locked: false });
      expect(unlock.status).toBe(200);
      expect(unlock.body.locked).toBe(false);

      const nowAllowed = await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", value: "#abcdef" });
      expect(nowAllowed.status).toBe(200);
      expect(nowAllowed.body.value).toBe("#abcdef");
    });

    it("locking an already-overridden token pins its current override value, not the default", async () => {
      const admin = await createAndLoginAdmin("design-tokens-lock3@example.com");

      await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", value: "#00ff00" });

      const lock = await request(app.getHttpServer())
        .put("/admin/settings/values/lock")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", locked: true });
      expect(lock.body.value).toBe("#00ff00");
    });

    it("locking and unlocking are both captured in the admin audit log", async () => {
      const admin = await createAndLoginAdmin("design-tokens-audit@example.com");

      await request(app.getHttpServer())
        .put("/admin/settings/values/lock")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", locked: true });
      await request(app.getHttpServer())
        .put("/admin/settings/values/lock")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ key: "design.color.accent", scopeType: "global", locked: false });

      const logs = await superuser.adminAuditLog.findMany({
        where: { action: { in: ["settings.lock", "settings.unlock"] } },
        orderBy: { createdAt: "asc" },
      });
      expect(logs.map((l) => l.action)).toEqual(["settings.lock", "settings.unlock"]);
    });
  });
});
