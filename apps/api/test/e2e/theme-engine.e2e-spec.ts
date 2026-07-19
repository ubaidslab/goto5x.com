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

  it("GET /themes lists the three seeded built-in themes", async () => {
    const { token } = await signupLoginAndCreateStore("themes-list@example.com", "themes-list-store");
    const res = await request(app.getHttpServer()).get("/themes").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.map((t: any) => t.name).sort()).toEqual(["Classic", "Minimal", "Modern"]);
  });

  it("a new store is auto-assigned a default (free) theme at creation", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("themes-default@example.com", "themes-default-store");
    const res = await request(app.getHttpServer())
      .get(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.theme.name).toBe("Classic");
    expect(res.body.theme.tier).toBe("free");
  });

  it("the customizer persists theme/settings changes, and they're read back exactly (FR-1.2/FR-1.3)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("themes-persist@example.com", "themes-persist-store");
    // Module 18 (FR-24.5) - "Modern" is `premium` tier, now actually gated by
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
    const modernTheme = themes.body.find((t: any) => t.name === "Modern");

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
    const theme = await superuser.theme.findFirstOrThrow({ where: { name: "Classic" } });
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
});
