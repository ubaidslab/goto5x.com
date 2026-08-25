import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS FR-1.1/FR-1.2/FR-1.6, §14.1 - theme assignment at store creation,
 * customizer persistence, tenant isolation on `store_theme_settings`, and
 * the `theme.coded_mode_enabled` gate.
 */
describe("Theme Engine (e2e) - SRS FR-1.x, §14.1", () => {
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
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    return { token, storeId: store.body.id as string };
  }

  async function upgradeToTier(sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: plan.id } });
  }

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

  it("GET /themes lists the five seeded built-in templates", async () => {
    const { token } = await signupLoginAndCreateStore("themes-list@example.com", "themes-list-store");
    const res = await request(app.getHttpServer()).get("/themes").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((t: any) => t.name).sort()).toEqual(["Atelier", "Editorial", "Market", "Start from blank", "Studio"]);
  });

  it("a new store is auto-assigned a default (free) theme at creation", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("themes-default@example.com", "themes-default-store");
    const res = await request(app.getHttpServer())
      .get(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.theme.name).toBe("Editorial");
    expect(res.body.theme.tier).toBe("free");
  });

  it("the customizer persists theme/settings changes, and they're read back exactly (FR-1.2/FR-1.3)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("themes-persist@example.com", "themes-persist-store");
    // Module 18 (FR-24.5) - "Studio" is `premium` tier, now actually gated by
    // theme.premium_tier_enabled (previously unenforced, per this file's own
    // "v1.0 default" tests below) - enable it globally so this test still
    // exercises what it's actually testing (settings persistence), not the
    // new gate itself.
    const adminToken = await fullyVerifiedAdminToken("themes-persist-admin@example.com");
    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "theme.premium_tier_enabled", scopeType: "global", value: true });

    const themes = await request(app.getHttpServer()).get("/themes").set("Authorization", `Bearer ${token}`);
    const modernTheme = themes.body.find((t: any) => t.name === "Studio");

    const newSettings = {
      colors: { primary: "#ff0000", background: "#000000", text: "#ffffff" },
      sections: [
        { id: "featured_products", visible: true },
        { id: "hero", visible: false },
      ],
    };
    const update = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ themeId: modernTheme.id, settings: newSettings });
    expect(update.status).toBe(200);

    const readBack = await request(app.getHttpServer())
      .get(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`);
    expect(readBack.body.theme.id).toBe(modernTheme.id);
    expect(readBack.body.settings).toEqual(newSettings);
  });

  it("rejects setting customCode when theme.coded_mode_enabled is off (v1.0 default for every seller)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("themes-coded-off@example.com", "themes-coded-off-store");
    const settingsService = app.get(SettingsService);
    await expect(settingsService.resolve<boolean>("theme.coded_mode_enabled")).resolves.toBe(false);

    const res = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ customCode: "<div>hello</div>" });
    expect(res.status).toBe(403);
  });

  it("Phase 4 close-out: GET .../theme-settings reports codedModeEnabled so the Customizer can render the real editor vs. a locked upsell card in one round-trip", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("themes-coded-flag@example.com", "themes-coded-flag-store");
    const adminToken = await fullyVerifiedAdminToken("themes-coded-flag-admin@example.com");

    const before = await request(app.getHttpServer())
      .get(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`);
    expect(before.body.codedModeEnabled).toBe(false);

    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "theme.coded_mode_enabled", scopeType: "global", value: true });

    const after = await request(app.getHttpServer())
      .get(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`);
    expect(after.body.codedModeEnabled).toBe(true);
  });

  it("allows setting customCode once an admin enables theme.coded_mode_enabled globally", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("themes-coded-on@example.com", "themes-coded-on-store");
    const adminToken = await fullyVerifiedAdminToken("themes-coded-admin@example.com");

    const write = await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "theme.coded_mode_enabled", scopeType: "global", value: true });
    expect(write.status).toBe(200);

    const res = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ customCode: "<div>hello</div>" });
    expect(res.status).toBe(200);
    expect(res.body.customCode).toBe("<div>hello</div>");
  });

  it("seller A cannot read or update seller B's store_theme_settings via the API (app-layer enforcement)", async () => {
    const a = await signupLoginAndCreateStore("themes-tenant-a@example.com", "themes-tenant-a-store");
    const b = await signupLoginAndCreateStore("themes-tenant-b@example.com", "themes-tenant-b-store");

    const crossRead = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/theme-settings`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossRead.status).toBe(404);

    const crossUpdate = await request(app.getHttpServer())
      .patch(`/stores/${a.storeId}/theme-settings`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ settings: { colors: { primary: "#hijacked" } } });
    expect(crossUpdate.status).toBe(404);

    const unchanged = await superuser.storeThemeSettings.findUniqueOrThrow({ where: { storeId: a.storeId } });
    expect((unchanged.settings as any).colors).toBeUndefined();
  });

  it("RLS denies cross-tenant access to store_theme_settings at the database level, independent of the app layer", async () => {
    const sellerA = await superuser.seller.create({
      data: { businessName: "DB-level A", user: { create: { email: "themes-db-a@example.com", roleFlags: ["seller"] } } },
    });
    const sellerB = await superuser.seller.create({
      data: { businessName: "DB-level B", user: { create: { email: "themes-db-b@example.com", roleFlags: ["seller"] } } },
    });
    const storeA = await superuser.store.create({ data: { sellerId: sellerA.id, name: "DB Store A", slug: "themes-db-store-a" } });
    await superuser.store.create({ data: { sellerId: sellerB.id, name: "DB Store B", slug: "themes-db-store-b" } });
    const theme = await superuser.theme.findFirstOrThrow({ where: { name: "Editorial" } });
    await superuser.storeThemeSettings.create({ data: { storeId: storeA.id, themeId: theme.id } });

    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

    const asSellerB = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerB.id}'`);
      return tx.storeThemeSettings.findMany();
    });
    expect(asSellerB).toEqual([]);

    const noContext = await runtime.$transaction(async (tx) => tx.storeThemeSettings.findMany());
    expect(noContext).toEqual([]); // fail-closed

    await runtime.$disconnect();
  });

  /**
   * D-Studio v1 - the real server-side gate the prototype's own "known
   * engineering gaps" note flagged as missing: settings.sections was, and
   * without this, would remain, unvalidated JSON. Founder-approved tier
   * reallocation: GO ships 8 core sections + Fade Up only; RUN adds 6 more
   * plus 6 animation presets; RISE unlocks the full 22-section/14-preset
   * library. FLY shares RISE's ceiling exactly (see section-catalog.ts).
   */
  describe("D-Studio v1 - section/variant/animation tier gating (server-side, not just client-hidden)", () => {
    async function sellerIdFor(email: string) {
      const user = await superuser.user.findUniqueOrThrow({ where: { email } });
      const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
      return seller.id;
    }

    it("a GO seller (default tier) cannot save a RISE-only section", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-go-section@example.com", "dstudio-go-section-store");
      const res = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "team", visible: true }] } });
      expect(res.status).toBe(403);
      expect(res.body.message.message).toMatch(/"team".*RISE/);
    });

    it("a GO seller cannot use a layout variant beyond what GO allows for that section", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-go-variant@example.com", "dstudio-go-variant-store");
      // "about" has maxVariantIndexByTier [0, 1] - GO is capped at index 0.
      const res = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "about", visible: true, variant: 1 }] } });
      expect(res.status).toBe(403);
    });

    it("a GO seller cannot assign a RISE-tier animation preset to an element", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-go-anim@example.com", "dstudio-go-anim-store");
      const res = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "hero", visible: true, elementAnimations: { heading: "ken-burns" } }] } });
      expect(res.status).toBe(403);
      expect(res.body.message.message).toMatch(/"ken-burns".*RISE/);
    });

    it("a GO seller CAN save a GO-tier section with its allowed variant and Fade Up", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-go-happy@example.com", "dstudio-go-happy-store");
      const res = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "hero", visible: true, variant: 0, elementAnimations: { heading: "fade-up" } }] } });
      expect(res.status).toBe(200);
    });

    it("a RISE seller can save the full library: a RISE-only section, its top variant, and a RISE-only animation preset", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-rise-happy@example.com", "dstudio-rise-happy-store");
      await upgradeToTier(await sellerIdFor("dstudio-rise-happy@example.com"), 2);

      const res = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          settings: {
            sections: [
              { id: "team", visible: true, variant: 1, elementAnimations: { heading: "ken-burns", image: "glass-reveal" } },
            ],
          },
        });
      expect(res.status).toBe(200);

      const readBack = await request(app.getHttpServer())
        .get(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`);
      expect(readBack.body.settings.sections[0].id).toBe("team");
    });

    it("rejects an unknown section id (400, malformed shape) and an unknown animation preset id (400)", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-malformed@example.com", "dstudio-malformed-store");
      const badSection = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "not_a_real_section", visible: true }] } });
      expect(badSection.status).toBe(400);

      const badAnimation = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "hero", visible: true, elementAnimations: { heading: "not-a-real-preset" } }] } });
      expect(badAnimation.status).toBe(400);
    });

    it("a rejected write never partially persists (the earlier-valid sections stay untouched)", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-atomic@example.com", "dstudio-atomic-store");
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "hero", visible: true }] } });

      const rejected = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "hero", visible: true }, { id: "team", visible: true }] } });
      expect(rejected.status).toBe(403);

      const readBack = await request(app.getHttpServer())
        .get(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`);
      expect(readBack.body.settings.sections).toEqual([{ id: "hero", visible: true }]);
    });
  });

  /**
   * D-Studio close-out (founder-requested time-limited feature grants) -
   * the seller-scoped `dstudio.tier_override_order` Settings Registry key
   * plus `settings_values.expires_at`, computed via
   * StoreThemeSettingsService.getEffectiveTierOrder() as
   * max(realTierOrder, resolved override). Exercises both the read side
   * (GET .../theme-settings's `effectiveTierOrder`) and the enforcement
   * side (PATCH .../theme-settings's validateSections() call), since the
   * founder's instruction was explicit that a grant must be real
   * enforcement, not just a UI-visible flag.
   */
  describe("D-Studio close-out: time-limited admin grants (dstudio.tier_override_order + expiresAt)", () => {
    async function sellerIdFor(email: string) {
      const user = await superuser.user.findUniqueOrThrow({ where: { email } });
      const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
      return seller.id;
    }

    it("a GO seller granted a live RISE-tier override can save a RISE-only section, and effectiveTierOrder reflects the grant", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-grant-live@example.com", "dstudio-grant-live-store");
      const sellerId = await sellerIdFor("dstudio-grant-live@example.com");
      const adminToken = await fullyVerifiedAdminToken("dstudio-grant-live-admin@example.com");

      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const grant = await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ key: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerId, value: 2, expiresAt: future });
      expect(grant.status).toBe(200);

      const before = await request(app.getHttpServer())
        .get(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`);
      expect(before.body.effectiveTierOrder).toBe(2);

      const res = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "team", visible: true }] } });
      expect(res.status).toBe(200);
    });

    it("an already-expired grant is treated as if it never existed - both effectiveTierOrder and enforcement fall back to the real (GO) tier", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-grant-expired@example.com", "dstudio-grant-expired-store");
      const sellerId = await sellerIdFor("dstudio-grant-expired@example.com");
      const adminToken = await fullyVerifiedAdminToken("dstudio-grant-expired-admin@example.com");

      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ key: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerId, value: 2, expiresAt: past });

      const before = await request(app.getHttpServer())
        .get(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`);
      expect(before.body.effectiveTierOrder).toBe(0);

      const res = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "team", visible: true }] } });
      expect(res.status).toBe(403);
    });

    it("a grant to seller A never leaks to seller B", async () => {
      const a = await signupLoginAndCreateStore("dstudio-grant-a@example.com", "dstudio-grant-a-store");
      const b = await signupLoginAndCreateStore("dstudio-grant-b@example.com", "dstudio-grant-b-store");
      const sellerIdA = await sellerIdFor("dstudio-grant-a@example.com");
      const adminToken = await fullyVerifiedAdminToken("dstudio-grant-leak-admin@example.com");

      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ key: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerIdA, value: 2, expiresAt: future });

      const bRes = await request(app.getHttpServer())
        .patch(`/stores/${b.storeId}/theme-settings`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ settings: { sections: [{ id: "team", visible: true }] } });
      expect(bRes.status).toBe(403);

      const aRes = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}/theme-settings`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ settings: { sections: [{ id: "team", visible: true }] } });
      expect(aRes.status).toBe(200);
    });

    it("revoking a grant (re-setting the override to -1) reverts enforcement immediately, and the write is audit-logged", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dstudio-grant-revoke@example.com", "dstudio-grant-revoke-store");
      const sellerId = await sellerIdFor("dstudio-grant-revoke@example.com");
      const adminToken = await fullyVerifiedAdminToken("dstudio-grant-revoke-admin@example.com");

      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ key: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerId, value: 2, expiresAt: future });

      const grantedOk = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "team", visible: true }] } });
      expect(grantedOk.status).toBe(200);

      const revoke = await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ key: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerId, value: -1, expiresAt: null });
      expect(revoke.status).toBe(200);

      const afterRevoke = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ settings: { sections: [{ id: "team", visible: true }, { id: "hero", visible: true }] } });
      expect(afterRevoke.status).toBe(403);

      const auditRows = await superuser.adminAuditLog.findMany({
        where: { action: "settings.update", targetType: "settings_value" },
        orderBy: { createdAt: "desc" },
      });
      expect(auditRows.length).toBeGreaterThanOrEqual(2); // the grant + the revoke
    });

    it("GET /admin/settings/resolve's precedence chain reports the grant's expiresAt, and never lets an expired-but-undeleted row win", async () => {
      const { storeId: _unused } = await signupLoginAndCreateStore("dstudio-grant-chain@example.com", "dstudio-grant-chain-store");
      const sellerId = await sellerIdFor("dstudio-grant-chain@example.com");
      const adminToken = await fullyVerifiedAdminToken("dstudio-grant-chain-admin@example.com");

      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await request(app.getHttpServer())
        .put("/admin/settings/values")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ key: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerId, value: 3, expiresAt: future });

      const resolved = await request(app.getHttpServer())
        .get(`/admin/settings/resolve?key=dstudio.tier_override_order&sellerId=${sellerId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resolved.body.winningScope).toBe("seller");
      expect(resolved.body.effectiveValue).toBe(3);
      const sellerEntry = resolved.body.chain.find((c: any) => c.scope === "seller");
      expect(new Date(sellerEntry.expiresAt).toISOString()).toBe(future);

      // Directly age the row past expiry without going through setValue()'s
      // own expiresAt handling, to simulate "expired but not yet
      // opportunistically deleted by a resolve() read" - resolveWithChain()
      // must still skip it as the winner.
      await superuser.settingsValue.updateMany({
        where: { definitionKey: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const resolvedAfterExpiry = await request(app.getHttpServer())
        .get(`/admin/settings/resolve?key=dstudio.tier_override_order&sellerId=${sellerId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resolvedAfterExpiry.body.winningScope).toBe("default");
      expect(resolvedAfterExpiry.body.effectiveValue).toBe(-1);
    });
  });
});
