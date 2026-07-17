import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";
import * as bcrypt from "bcryptjs";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS §5.27/FR-27.1-27.7, §14.25 - the Listing Moderation Engine: banned/
 * restricted keyword and category rules, new-seller probation, the trusted-
 * seller bypass, the REVIEWER admin sub-role, and the "not publicly visible
 * until approved" guarantee across every public storefront surface.
 */
describe("Listing Moderation Engine (e2e) - SRS §5.27/FR-27.x, §14.25", () => {
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
      .send({ email, password: "correct-horse-battery", businessName: `Business for ${email}` });
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

  async function createAdminAndGetToken(email: string, password: string, role: "super_admin" | "reviewer") {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role, mfaEnabled: false } });

    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  async function overrideGlobalSetting(key: string, value: unknown) {
    await superuser.settingsValue.create({
      data: { definitionKey: key, scopeType: "global", scopeId: null, value: value as any },
    });
  }

  it(
    "a non-trusted new seller's first product enters the moderation queue (new-seller probation) and is invisible " +
      "on every public storefront surface - list, detail, search, and collections (FR-27.3/27.5)",
    async () => {
      const { token, storeId } = await signupLoginAndCreateStore("probation@example.com", "probation-store");
      const hostname = "probation-store.goto5x.com";

      const create = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Probation Product", description: "First listing", status: "active" });
      expect(create.status).toBe(201);
      expect(create.body.moderationStatus).toBe("pending");
      const productId = create.body.id as string;

      const collection = await request(app.getHttpServer())
        .post(`/stores/${storeId}/collections`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Featured", slug: "featured" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/collections/${collection.body.id}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ productId, sortOrder: 0 });

      const list = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
      expect(list.body).toEqual([]);

      const detail = await request(app.getHttpServer())
        .get(`/storefront/products/${productId}`)
        .query({ hostname });
      expect(detail.status).toBe(404);

      const search = await request(app.getHttpServer())
        .get("/storefront/search")
        .query({ hostname, q: "Probation" });
      expect(search.body).toEqual([]);

      const collectionDetail = await request(app.getHttpServer())
        .get(`/storefront/collections/${collection.body.id}`)
        .query({ hostname });
      expect(collectionDetail.body.products).toEqual([]);

      const superAdminToken = await createAdminAndGetToken("mod-admin1@example.com", "admin-password-1", "super_admin");
      const queue = await request(app.getHttpServer())
        .get("/admin/moderation/queue")
        .set("Authorization", `Bearer ${superAdminToken}`);
      expect(queue.status).toBe(200);
      expect(queue.body.map((p: any) => p.id)).toContain(productId);
      expect(queue.body.find((p: any) => p.id === productId).store.slug).toBe("probation-store");
    },
  );

  it("approving a queued product makes it publicly visible everywhere and is audit-logged (FR-27.5/27.6)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("approve-flow@example.com", "approve-flow-store");
    const hostname = "approve-flow-store.goto5x.com";
    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Queued Then Approved", status: "active" });
    const productId = create.body.id as string;

    const adminToken = await createAdminAndGetToken("mod-admin2@example.com", "admin-password-2", "super_admin");
    const approve = await request(app.getHttpServer())
      .post(`/admin/moderation/queue/${productId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ notes: "Looks fine." });
    expect(approve.status).toBe(201);
    expect(approve.body.moderationStatus).toBe("approved");

    const list = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(list.body.map((p: any) => p.id)).toEqual([productId]);

    const auditLogs = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(auditLogs.body.some((e: any) => e.action === "moderation.approve" && e.targetId === productId)).toBe(true);
  });

  it("rejecting a queued product requires notes, keeps it invisible, and is audit-logged (FR-27.5/27.6)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("reject-flow@example.com", "reject-flow-store");
    const hostname = "reject-flow-store.goto5x.com";
    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Queued Then Rejected", status: "active" });
    const productId = create.body.id as string;

    const adminToken = await createAdminAndGetToken("mod-admin3@example.com", "admin-password-3", "super_admin");
    const missingNotes = await request(app.getHttpServer())
      .post(`/admin/moderation/queue/${productId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(missingNotes.status).toBe(400);

    const reject = await request(app.getHttpServer())
      .post(`/admin/moderation/queue/${productId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ notes: "Prohibited item." });
    expect(reject.status).toBe(201);
    expect(reject.body.moderationStatus).toBe("rejected");

    const list = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(list.body).toEqual([]);

    const auditLogs = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(auditLogs.body.some((e: any) => e.action === "moderation.reject" && e.targetId === productId)).toBe(true);
  });

  it("a trusted seller's products bypass moderation entirely and are visible immediately (FR-27.4)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("trusted@example.com", "trusted-store");
    const hostname = "trusted-store.goto5x.com";
    const user = await superuser.user.findUniqueOrThrow({ where: { email: "trusted@example.com" } });
    await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true } });

    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Trusted Seller Product", status: "active" });
    expect(create.body.moderationStatus).toBe("not_required");

    const list = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(list.body.map((p: any) => p.id)).toEqual([create.body.id]);
  });

  it("a banned keyword blocks product creation outright, not just queues it (FR-27.1)", async () => {
    await overrideGlobalSetting("moderation.banned_keywords", ["contraband"]);
    const { token, storeId } = await signupLoginAndCreateStore("banned@example.com", "banned-store");

    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Contraband Item", status: "active" });
    expect(create.status).toBe(400);

    const list = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body).toEqual([]);
  });

  it("a restricted keyword queues the listing (not a hard block) once past probation (FR-27.1)", async () => {
    await overrideGlobalSetting("moderation.new_seller_probation_count", 0);
    await overrideGlobalSetting("moderation.restricted_keywords", ["vape"]);
    const { token, storeId } = await signupLoginAndCreateStore("restricted-kw@example.com", "restricted-kw-store");

    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Vape Pen", status: "active" });
    expect(create.status).toBe(201);
    expect(create.body.moderationStatus).toBe("pending");

    const adminToken = await createAdminAndGetToken("mod-admin4@example.com", "admin-password-4", "super_admin");
    const auditLogs = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    const entry = auditLogs.body.find((e: any) => e.targetId === create.body.id && e.action === "moderation.queued");
    expect(entry?.afterValue?.reason).toBe("restricted_keyword");
  });

  it("a restricted category always queues the listing once past probation (FR-27.2)", async () => {
    await overrideGlobalSetting("moderation.new_seller_probation_count", 0);
    const category = await superuser.category.create({ data: { name: "Restricted Cat", slug: `restricted-cat-${Date.now()}` } });
    await overrideGlobalSetting("moderation.restricted_categories", [category.id]);
    const { token, storeId } = await signupLoginAndCreateStore("restricted-cat@example.com", "restricted-cat-store");

    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Regular Title", status: "active", categoryId: category.id });
    expect(create.status).toBe(201);
    expect(create.body.moderationStatus).toBe("pending");
  });

  it("probation lifts after N approved products - the (N+1)th listing publishes immediately (FR-27.3)", async () => {
    await overrideGlobalSetting("moderation.new_seller_probation_count", 1);
    const { token, storeId } = await signupLoginAndCreateStore("probation-lift@example.com", "probation-lift-store");
    const hostname = "probation-lift-store.goto5x.com";

    const first = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "First Listing", status: "active" });
    expect(first.body.moderationStatus).toBe("pending");

    const adminToken = await createAdminAndGetToken("mod-admin5@example.com", "admin-password-5", "super_admin");
    await request(app.getHttpServer())
      .post(`/admin/moderation/queue/${first.body.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    const second = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Second Listing", status: "active" });
    expect(second.body.moderationStatus).toBe("not_required");

    const list = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(list.body.map((p: any) => p.id).sort()).toEqual([first.body.id, second.body.id].sort());
  });

  it(
    "a REVIEWER admin account can approve/reject a queued product with notes, and cannot reach any other admin " +
      "surface (SRS §4, FR-27.6, §14.25 negative-access test)",
    async () => {
      const { token, storeId } = await signupLoginAndCreateStore("reviewer-scope@example.com", "reviewer-scope-store");
      const create = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Reviewer Scoped Product", status: "active" });
      const productId = create.body.id as string;

      const reviewerToken = await createAdminAndGetToken("reviewer1@example.com", "reviewer-password-1", "reviewer");

      const queue = await request(app.getHttpServer())
        .get("/admin/moderation/queue")
        .set("Authorization", `Bearer ${reviewerToken}`);
      expect(queue.status).toBe(200);

      const approve = await request(app.getHttpServer())
        .post(`/admin/moderation/queue/${productId}/approve`)
        .set("Authorization", `Bearer ${reviewerToken}`)
        .send({ notes: "Reviewed by reviewer." });
      expect(approve.status).toBe(201);
      expect(approve.body.moderationStatus).toBe("approved");

      const auditLogs = await request(app.getHttpServer())
        .get("/admin/audit-logs")
        .set("Authorization", `Bearer ${reviewerToken}`);
      expect(auditLogs.status).toBe(403);

      const settings = await request(app.getHttpServer())
        .get("/admin/settings/definitions")
        .set("Authorization", `Bearer ${reviewerToken}`);
      expect(settings.status).toBe(403);
    },
  );
});
