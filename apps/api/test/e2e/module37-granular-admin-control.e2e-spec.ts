import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";
import * as bcrypt from "bcryptjs";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 37 (SRS §5.54/FR-54.1-54.6) - Advanced Granular Admin Control.
 * Four narrow, audit-logged admin controls, all reusing existing
 * mechanisms: a seller-scope listing block, instant single-product
 * takedown/restore, supplier-listed product block/approve via the
 * existing moderation queue, and a seller-scope Settings Registry
 * override. Additive to, not a replacement for, SellerLifecycleStatus
 * (FR-54.6, not separately tested - untouched by anything here).
 */
describe("Advanced Granular Admin Control (e2e) - SRS §5.54, §14.54", () => {
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
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, storeId: store.body.id as string, sellerId: seller.id as string };
  }

  async function signupLoginSupplier(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Supplier ${email}`, role: "supplier" });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    return login.body.accessToken as string;
  }

  async function createAdminAndGetToken(email: string) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: PASSWORD });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  async function seedSupplierListing(supplierEmail: string, title: string) {
    const user = await superuser.user.findUniqueOrThrow({ where: { email: supplierEmail }, include: { supplier: true } });
    const listing = await superuser.supplierListing.create({
      data: {
        supplierId: user.supplier!.id,
        adapterType: "printify",
        externalProductId: `ext-${Date.now()}`,
        title,
        price: 12.5,
        shippingCost: 5,
        estimatedDeliveryMinDays: 7,
        estimatedDeliveryMaxDays: 14,
        supportedCountries: ["PK"],
        rawPayload: {},
      },
    });
    return listing;
  }

  it("FR-54.1/54.5: a seller flagged catalog.listing_blocked cannot create a new product (existing listings unaffected), and it's audit-logged", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreateStore("blocked-seller@example.com", "blocked-seller-store");

    const firstProduct = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Pre-existing Product", status: "active" });
    expect(firstProduct.status).toBe(201);

    const adminToken = await createAdminAndGetToken("gac-admin1@example.com");
    const override = await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "catalog.listing_blocked", scopeType: "seller", scopeId: sellerId, value: true });
    expect(override.status).toBe(200);

    const blockedCreate = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Should Be Blocked", status: "active" });
    expect(blockedCreate.status).toBe(400);

    const existingListing = await request(app.getHttpServer())
      .get(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`);
    expect(existingListing.body.map((p: any) => p.id)).toContain(firstProduct.body.id);

    const auditLogs = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    const entry = auditLogs.body.find(
      (e: any) => e.action === "settings.update" && e.targetId === override.body.id,
    );
    expect(entry).toBeDefined();
    expect(entry.afterValue).toBe(true);
  });

  it("FR-54.2/54.5: an admin can force-remove an approved product (instant storefront invisibility) and restore it, both audit-logged", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("removable@example.com", "removable-store");
    const hostname = "removable-store.uzeyn.com";
    const userRow = await superuser.user.findUniqueOrThrow({ where: { email: "removable@example.com" } });
    await superuser.seller.update({ where: { userId: userRow.id }, data: { isTrusted: true } });

    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Trusted Product", status: "active" });
    expect(create.body.moderationStatus).toBe("not_required");
    const productId = create.body.id as string;

    const visibleBefore = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(visibleBefore.body.map((p: any) => p.id)).toEqual([productId]);

    const adminToken = await createAdminAndGetToken("gac-admin2@example.com");
    const remove = await request(app.getHttpServer())
      .post(`/admin/products/${productId}/remove`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ notes: "Counterfeit report." });
    expect(remove.status).toBe(201);
    expect(remove.body.moderationStatus).toBe("admin_removed");

    const visibleAfterRemove = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(visibleAfterRemove.body).toEqual([]);
    const detailAfterRemove = await request(app.getHttpServer())
      .get(`/storefront/products/${productId}`)
      .query({ hostname });
    expect(detailAfterRemove.status).toBe(404);

    const restore = await request(app.getHttpServer())
      .post(`/admin/products/${productId}/restore`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ notes: "Report was unfounded." });
    expect(restore.status).toBe(201);
    expect(restore.body.moderationStatus).toBe("approved");

    const visibleAfterRestore = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(visibleAfterRestore.body.map((p: any) => p.id)).toEqual([productId]);

    const auditLogs = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(auditLogs.body.some((e: any) => e.action === "moderation.force_remove" && e.targetId === productId)).toBe(true);
    expect(auditLogs.body.some((e: any) => e.action === "moderation.restore" && e.targetId === productId)).toBe(true);
  });

  it("FR-54.3: a supplier-listed product is surfaced (source: supplier) in the existing moderation queue and can be approved through it, no new queue", async () => {
    await superuser.settingsValue.create({
      data: { definitionKey: "moderation.restricted_keywords", scopeType: "global", scopeId: null, value: ["special"] as any },
    });
    const { token, storeId } = await signupLoginAndCreateStore("supplier-review-seller@example.com", "supplier-review-store");
    const hostname = "supplier-review-store.uzeyn.com";
    const supplierToken = await signupLoginSupplier("gac-supplier@example.com");
    const listing = await seedSupplierListing("gac-supplier@example.com", "Special Printify Mug");

    const linkRes = await request(app.getHttpServer())
      .post("/supplier/store-links")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSlug: "supplier-review-store" });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/supplier-links/${linkRes.body.id}/approve`)
      .set("Authorization", `Bearer ${token}`);

    const submit = await request(app.getHttpServer())
      .post("/supplier/listings/submit-review")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSupplierLinkId: linkRes.body.id, supplierListingId: listing.id });
    const approveReview = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`)
      .set("Authorization", `Bearer ${token}`);
    expect(approveReview.status).toBe(200);
    const productId = approveReview.body.product.id as string;
    expect(approveReview.body.product.moderationStatus).toBe("pending");

    const adminToken = await createAdminAndGetToken("gac-admin3@example.com");
    const queue = await request(app.getHttpServer())
      .get("/admin/moderation/queue")
      .set("Authorization", `Bearer ${adminToken}`);
    const queuedEntry = queue.body.find((p: any) => p.id === productId);
    expect(queuedEntry).toBeDefined();
    expect(queuedEntry.sourceType).toBe("supplier");

    const approve = await request(app.getHttpServer())
      .post(`/admin/moderation/queue/${productId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ notes: "Supplier listing looks fine." });
    expect(approve.status).toBe(201);
    expect(approve.body.moderationStatus).toBe("approved");

    const storefrontList = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(storefrontList.body.map((p: any) => p.id)).toEqual([productId]);
  });

  it("FR-54.4/54.5: an admin-overridden seller-scope Settings Registry value wins for that seller only - a second seller on the same plan is unaffected", async () => {
    const sellerA = await signupLoginAndCreateStore("gac-seller-a@example.com", "gac-seller-a-store");
    const sellerB = await signupLoginAndCreateStore("gac-seller-b@example.com", "gac-seller-b-store");

    const adminToken = await createAdminAndGetToken("gac-admin4@example.com");
    const override = await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "catalog.listing_blocked", scopeType: "seller", scopeId: sellerA.sellerId, value: true });
    expect(override.status).toBe(200);

    const resolveA = await request(app.getHttpServer())
      .get(`/admin/settings/resolve?key=catalog.listing_blocked&sellerId=${sellerA.sellerId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(resolveA.body.winningScope).toBe("seller");
    expect(resolveA.body.effectiveValue).toBe(true);

    const resolveB = await request(app.getHttpServer())
      .get(`/admin/settings/resolve?key=catalog.listing_blocked&sellerId=${sellerB.sellerId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(resolveB.body.winningScope).toBe("default");
    expect(resolveB.body.effectiveValue).toBe(false);

    const blockedA = await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/products`)
      .set("Authorization", `Bearer ${sellerA.token}`)
      .send({ title: "Blocked For A", status: "active" });
    expect(blockedA.status).toBe(400);

    const okB = await request(app.getHttpServer())
      .post(`/stores/${sellerB.storeId}/products`)
      .set("Authorization", `Bearer ${sellerB.token}`)
      .send({ title: "Fine For B", status: "active" });
    expect(okB.status).toBe(201);

    const auditLogs = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(auditLogs.body.some((e: any) => e.action === "settings.update" && e.targetId === override.body.id)).toBe(true);
  });
});
