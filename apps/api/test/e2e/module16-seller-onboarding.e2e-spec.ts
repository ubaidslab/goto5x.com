import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const PASSWORD = "correct-horse-battery";
const S3_TEST_PORT = 4569; // must match .env.test's MINIO_ENDPOINT - see media.e2e-spec.ts's comment on why this is safe under --runInBand
const BUCKET = "goto5x-media-test";

describe("Seller Onboarding Wizard (e2e) - SRS §5.20/§5.25, FR-20.1/FR-25.5, §14.20", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let s3: TestS3Server;

  beforeAll(async () => {
    s3 = await startTestS3Server(S3_TEST_PORT, BUCKET);
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
    await s3.close();
  });

  afterEach(async () => {
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
  });

  async function signupLoginAndCreateStore(email: string, slug: string, country?: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}`, country });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    return { token, storeId: store.body.id as string };
  }

  describe("Regional launch gating (FR-25.5)", () => {
    it("a seller signup from an allowed country (PK, the default) succeeds normally", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ agreementAccepted: true, email: "pk-seller@example.com", password: PASSWORD, businessName: "PK Seller", country: "PK" });
      expect(res.status).toBe(201);
      expect(res.body.userId).toBeDefined();
      expect(res.body.waitlisted).toBeUndefined();

      const user = await superuser.user.findUnique({ where: { email: "pk-seller@example.com" } });
      expect(user).not.toBeNull();
    });

    it("a seller signup from a non-allowed country shows the waitlist response instead of an error, and creates no account", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ agreementAccepted: true, email: "in-seller@example.com", password: PASSWORD, businessName: "IN Seller", country: "IN" });
      expect(res.status).toBe(201);
      expect(res.body.waitlisted).toBe(true);
      expect(res.body.userId).toBeUndefined();

      const user = await superuser.user.findUnique({ where: { email: "in-seller@example.com" } });
      expect(user).toBeNull();

      const waitlistRow = await superuser.sellerSignupWaitlist.findFirst({ where: { email: "in-seller@example.com" } });
      expect(waitlistRow).not.toBeNull();
      expect(waitlistRow!.country).toBe("IN");
    });

    it("adding a country to the allowed-countries list (no deploy) immediately allows seller signup from it on the very next request", async () => {
      const blocked = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ agreementAccepted: true, email: "bd-seller@example.com", password: PASSWORD, businessName: "BD Seller", country: "BD" });
      expect(blocked.body.waitlisted).toBe(true);

      const settingsService = app.get(SettingsService);
      await settingsService.setValue(
        "auth.seller_signup_allowed_countries",
        "global",
        null,
        ["PK", "BD"],
        "00000000-0000-0000-0000-000000000000",
      );

      const allowed = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ agreementAccepted: true, email: "bd-seller-2@example.com", password: PASSWORD, businessName: "BD Seller 2", country: "BD" });
      expect(allowed.status).toBe(201);
      expect(allowed.body.userId).toBeDefined();
    });

    it("a supplier signup is never regionally gated (FR-25.5 is seller-specific)", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: "supplier@example.com", password: PASSWORD, businessName: "A Supplier", role: "supplier", country: "IN" });
      expect(res.status).toBe(201);
      expect(res.body.userId).toBeDefined();
    });
  });

  describe("Onboarding wizard progress (FR-20.1)", () => {
    it("a brand-new store starts with every step incomplete and no completedAt", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("onboard-fresh@example.com", "onboard-fresh-store");
      const progress = await request(app.getHttpServer())
        .get(`/stores/${storeId}/onboarding`)
        .set("Authorization", `Bearer ${token}`);
      expect(progress.body).toEqual({ theme: false, logo: false, product: false, domain: false, completedAt: null });
    });

    it("a real customizer save completes the theme step without a separate ack", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("onboard-theme@example.com", "onboard-theme-store");
      const themeSettings = await request(app.getHttpServer())
        .get(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`);

      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/theme-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ themeId: themeSettings.body.themeId, settings: {} });

      const progress = await request(app.getHttpServer())
        .get(`/stores/${storeId}/onboarding`)
        .set("Authorization", `Bearer ${token}`);
      expect(progress.body.theme).toBe(true);
    });

    it("the theme step's explicit 'keep this theme' ack completes it without any customizer save", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("onboard-theme-ack@example.com", "onboard-theme-ack-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/onboarding/theme-ack`)
        .set("Authorization", `Bearer ${token}`);

      const progress = await request(app.getHttpServer())
        .get(`/stores/${storeId}/onboarding`)
        .set("Authorization", `Bearer ${token}`);
      expect(progress.body.theme).toBe(true);
    });

    it("setting a logo completes the logo step", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("onboard-logo@example.com", "onboard-logo-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/logo`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("fake-png-bytes"), { filename: "logo.png", contentType: "image/png" });

      const progress = await request(app.getHttpServer())
        .get(`/stores/${storeId}/onboarding`)
        .set("Authorization", `Bearer ${token}`);
      expect(progress.body.logo).toBe(true);
    });

    it("creating a product completes the product step regardless of its status", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("onboard-product@example.com", "onboard-product-store");
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "First product" });

      const progress = await request(app.getHttpServer())
        .get(`/stores/${storeId}/onboarding`)
        .set("Authorization", `Bearer ${token}`);
      expect(progress.body.product).toBe(true);
    });

    it("attaching a domain completes the domain step; the explicit 'use free subdomain' ack also completes it on its own", async () => {
      const a = await signupLoginAndCreateStore("onboard-domain-a@example.com", "onboard-domain-a-store");
      await request(app.getHttpServer())
        .post(`/stores/${a.storeId}/domains`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ domainName: "onboard-domain-a.example.com" });
      const progressA = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/onboarding`)
        .set("Authorization", `Bearer ${a.token}`);
      expect(progressA.body.domain).toBe(true);

      const b = await signupLoginAndCreateStore("onboard-domain-b@example.com", "onboard-domain-b-store");
      await request(app.getHttpServer())
        .post(`/stores/${b.storeId}/onboarding/domain-ack`)
        .set("Authorization", `Bearer ${b.token}`);
      const progressB = await request(app.getHttpServer())
        .get(`/stores/${b.storeId}/onboarding`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(progressB.body.domain).toBe(true);
    });

    it("completing all four steps sets completedAt, and it stays set (sticky) even after the only product is deleted (§14.20)", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("onboard-complete@example.com", "onboard-complete-store");

      await request(app.getHttpServer()).post(`/stores/${storeId}/onboarding/theme-ack`).set("Authorization", `Bearer ${token}`);
      await request(app.getHttpServer()).post(`/stores/${storeId}/onboarding/domain-ack`).set("Authorization", `Bearer ${token}`);
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/logo`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("fake-png-bytes"), { filename: "logo.png", contentType: "image/png" });
      const product = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Only product" });

      const completed = await request(app.getHttpServer())
        .get(`/stores/${storeId}/onboarding`)
        .set("Authorization", `Bearer ${token}`);
      expect(completed.body.completedAt).not.toBeNull();
      expect(completed.body).toMatchObject({ theme: true, logo: true, product: true, domain: true });

      await request(app.getHttpServer())
        .delete(`/stores/${storeId}/products/${product.body.id}`)
        .set("Authorization", `Bearer ${token}`);

      const afterDelete = await request(app.getHttpServer())
        .get(`/stores/${storeId}/onboarding`)
        .set("Authorization", `Bearer ${token}`);
      expect(afterDelete.body.completedAt).not.toBeNull();
      expect(afterDelete.body).toMatchObject({ theme: true, logo: true, product: true, domain: true });
    });
  });
});
