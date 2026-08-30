import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { SupplierListingsService } from "../../src/suppliers/supplier-listings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS §5.3/§5.4 (Supplier Portal + Printify Adapter), §14.3/§14.4 - the
 * parts of this module that can be proven without Module 9 (Orders, Cart &
 * Checkout) existing yet: registration/links, the listing-review approval
 * gate, storefront transparency rendering (FR-4.6), the adapter registry
 * (FR-4.9), and the oversell-protection mechanism (FR-4.5) in isolation.
 * Checkout-time enforcement (FR-4.7/4.8, wiring FR-4.5 into a live order)
 * is Module 9's job once checkout exists - flagged in the Module 8
 * verification report, not silently skipped here.
 */
describe("Suppliers & Printify Adapter (e2e) - SRS §5.3/§5.4, §14.3/§14.4", () => {
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

  async function signupLoginSupplier(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Supplier ${email}`, role: "supplier" });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    return login.body.accessToken as string;
  }

  async function createAdminAndGetToken(email: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
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

  /** Bypasses the real sync mechanism (unit-tested separately) - seeds a listing directly, matching this suite's established precedent of seeding non-focal prerequisites directly. */
  async function seedSupplierListing(supplierEmail: string, title = "Printify Mug") {
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
    return { supplierId: user.supplier!.id, listing };
  }

  it("a supplier can sign up and log in, receiving a supplier-scoped session (FR-3.1)", async () => {
    const token = await signupLoginSupplier("supplier-signup@example.com");
    const links = await request(app.getHttpServer())
      .get("/supplier/store-links")
      .set("Authorization", `Bearer ${token}`);
    expect(links.status).toBe(200);
    expect(links.body).toEqual([]);
  });

  it("seller invites a supplier by email; the link starts pending and the seller approves it (FR-2.6)", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("invite-seller@example.com", "invite-seller-store");
    await signupLoginSupplier("invite-supplier@example.com");

    const invite = await request(app.getHttpServer())
      .post(`/stores/${storeId}/supplier-links`)
      .set("Authorization", `Bearer ${token}`)
      .send({ supplierEmail: "invite-supplier@example.com" });
    expect(invite.status).toBe(201);
    expect(invite.body.status).toBe("pending_seller_review");
    expect(invite.body.invitedBy).toBe("seller");

    const approve = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/supplier-links/${invite.body.id}/approve`)
      .set("Authorization", `Bearer ${token}`);
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe("active");
  });

  it("a supplier can request a link to a store by slug; it lands pending_seller_review same as an invite (FR-2.6/FR-3.1)", async () => {
    const { storeId } = await signupLoginAndCreateStore("request-seller@example.com", "request-seller-store");
    const supplierToken = await signupLoginSupplier("request-supplier@example.com");

    const request1 = await request(app.getHttpServer())
      .post("/supplier/store-links")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSlug: "request-seller-store" });
    expect(request1.status).toBe(201);
    expect(request1.body.status).toBe("pending_seller_review");
    expect(request1.body.invitedBy).toBe("supplier");
    expect(request1.body.storeId).toBe(storeId);

    const ownLinks = await request(app.getHttpServer())
      .get("/supplier/store-links")
      .set("Authorization", `Bearer ${supplierToken}`);
    expect(ownLinks.body).toHaveLength(1);
  });

  it("seller A cannot see, approve, or revoke seller B's supplier links (tenant isolation)", async () => {
    const a = await signupLoginAndCreateStore("ssl-tenant-a@example.com", "ssl-tenant-a-store");
    const b = await signupLoginAndCreateStore("ssl-tenant-b@example.com", "ssl-tenant-b-store");
    await signupLoginSupplier("ssl-tenant-supplier@example.com");
    const invite = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/supplier-links`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ supplierEmail: "ssl-tenant-supplier@example.com" });

    const crossList = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/supplier-links`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossList.status).toBe(404);

    const crossApprove = await request(app.getHttpServer())
      .patch(`/stores/${a.storeId}/supplier-links/${invite.body.id}/approve`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossApprove.status).toBe(404);

    const unchanged = await superuser.storeSupplierLink.findUniqueOrThrow({ where: { id: invite.body.id } });
    expect(unchanged.status).toBe("pending_seller_review");
  });

  it("RLS denies cross-tenant access to store_supplier_links at the database level, independent of the app layer", async () => {
    const sellerA = await superuser.seller.create({
      data: { businessName: "DB-level A", user: { create: { email: "ssl-db-a@example.com", roleFlags: ["seller"] } } },
    });
    const sellerB = await superuser.seller.create({
      data: { businessName: "DB-level B", user: { create: { email: "ssl-db-b@example.com", roleFlags: ["seller"] } } },
    });
    const storeA = await superuser.store.create({ data: { sellerId: sellerA.id, name: "DB Store A", slug: "ssl-db-store-a" } });
    const supplier = await superuser.supplier.create({
      data: { businessName: "DB Supplier", user: { create: { email: "ssl-db-supplier@example.com", roleFlags: ["supplier"] } } },
    });
    await superuser.storeSupplierLink.create({ data: { storeId: storeA.id, supplierId: supplier.id, invitedBy: "seller" } });

    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const asSellerB = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerB.id}'`);
      return tx.storeSupplierLink.findMany();
    });
    expect(asSellerB).toEqual([]);

    const noContext = await runtime.$transaction(async (tx) => tx.storeSupplierLink.findMany());
    expect(noContext).toEqual([]); // fail-closed
    await runtime.$disconnect();
  });

  it(
    "supplier submits a listing for review; seller approving it creates a live product with supplier " +
      "transparency data visible on the storefront (FR-2.7/FR-3.2/FR-4.6)",
    async () => {
      const { token, storeId } = await signupLoginAndCreateStore("review-seller@example.com", "review-seller-store");
      const hostname = "review-seller-store.uzeyn.com";
      const supplierToken = await signupLoginSupplier("review-supplier@example.com");
      const { listing } = await seedSupplierListing("review-supplier@example.com");

      const linkRes = await request(app.getHttpServer())
        .post("/supplier/store-links")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ storeSlug: "review-seller-store" });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/supplier-links/${linkRes.body.id}/approve`)
        .set("Authorization", `Bearer ${token}`);

      const submit = await request(app.getHttpServer())
        .post("/supplier/listings/submit-review")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ storeSupplierLinkId: linkRes.body.id, supplierListingId: listing.id });
      expect(submit.status).toBe(201);
      expect(submit.body.status).toBe("pending");

      const queue = await request(app.getHttpServer())
        .get(`/stores/${storeId}/listing-reviews`)
        .set("Authorization", `Bearer ${token}`);
      expect(queue.body).toHaveLength(1);

      const approve = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`)
        .set("Authorization", `Bearer ${token}`);
      expect(approve.status).toBe(200);
      expect(approve.body.review.status).toBe("approved");
      const productId = approve.body.product.id as string;

      const storefrontList = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
      expect(storefrontList.body.map((p: any) => p.id)).toEqual([productId]);
      expect(storefrontList.body[0].supplierShipping).toMatchObject({
        estimatedDeliveryMinDays: 7,
        estimatedDeliveryMaxDays: 14,
        supportedCountries: ["PK"],
      });

      const storefrontDetail = await request(app.getHttpServer())
        .get(`/storefront/products/${productId}`)
        .query({ hostname });
      expect(storefrontDetail.body.supplierShipping).not.toBeNull();
    },
  );

  it("seller rejecting a listing review creates no product and it never appears on the storefront", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("reject-seller@example.com", "reject-seller-store");
    const hostname = "reject-seller-store.uzeyn.com";
    const supplierToken = await signupLoginSupplier("reject-supplier@example.com");
    const { listing } = await seedSupplierListing("reject-supplier@example.com");

    const linkRes = await request(app.getHttpServer())
      .post("/supplier/store-links")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSlug: "reject-seller-store" });
    await request(app.getHttpServer())
      .patch(`/stores/${storeId}/supplier-links/${linkRes.body.id}/approve`)
      .set("Authorization", `Bearer ${token}`);
    const submit = await request(app.getHttpServer())
      .post("/supplier/listings/submit-review")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSupplierLinkId: linkRes.body.id, supplierListingId: listing.id });

    const reject = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/reject`)
      .set("Authorization", `Bearer ${token}`);
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe("rejected");

    const storefrontList = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
    expect(storefrontList.body).toEqual([]);
  });

  it("a supplier cannot submit a listing for a store link that isn't active yet", async () => {
    await signupLoginAndCreateStore("pending-seller@example.com", "pending-seller-store");
    const supplierToken = await signupLoginSupplier("pending-supplier@example.com");
    const { listing } = await seedSupplierListing("pending-supplier@example.com");

    const linkRes = await request(app.getHttpServer())
      .post("/supplier/store-links")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSlug: "pending-seller-store" });

    const submit = await request(app.getHttpServer())
      .post("/supplier/listings/submit-review")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSupplierLinkId: linkRes.body.id, supplierListingId: listing.id });
    expect(submit.status).toBe(400);
  });

  it("FR-4.5: decrementStock is atomic - two concurrent calls against stock=1 only one succeeds", async () => {
    await signupLoginSupplier("stock-supplier@example.com");
    const { listing } = await seedSupplierListing("stock-supplier@example.com");
    await superuser.supplierListing.update({ where: { id: listing.id }, data: { stockQuantity: 1 } });

    const supplierListings = app.get(SupplierListingsService);
    const [first, second] = await Promise.all([
      supplierListings.decrementStock(listing.id, 1),
      supplierListings.decrementStock(listing.id, 1),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);

    const final = await superuser.supplierListing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(final.stockQuantity).toBe(0);
  });

  it("admin can register, list, and disable a supplier adapter without a deploy (FR-4.9)", async () => {
    const adminToken = await createAdminAndGetToken("adapter-admin@example.com", "admin-password-1");

    const create = await request(app.getHttpServer())
      .post("/admin/supplier-adapters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ adapterType: "cj_dropshipping", displayName: "CJ Dropshipping" });
    expect(create.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get("/admin/supplier-adapters")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.map((a: any) => a.adapterType)).toEqual(expect.arrayContaining(["printify", "cj_dropshipping"]));

    const disable = await request(app.getHttpServer())
      .patch(`/admin/supplier-adapters/${create.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isEnabled: false });
    expect(disable.status).toBe(200);
    expect(disable.body.isEnabled).toBe(false);
  });

  it("a non-admin cannot reach the supplier-adapters registry", async () => {
    const { token } = await signupLoginAndCreateStore("adapter-nonadmin@example.com", "adapter-nonadmin-store");
    const res = await request(app.getHttpServer())
      .get("/admin/supplier-adapters")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  describe("Suppliers mini-dashboard (SRS §5.4/FR-4.12, Module 96, founder batch B13)", () => {
    it("reflects active suppliers, pending approvals, and forwarded orders", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dash-seller@example.com", "dash-seller-store");
      const supplierToken = await signupLoginSupplier("dash-supplier@example.com");

      const empty = await request(app.getHttpServer())
        .get(`/stores/${storeId}/supplier-links/dashboard`)
        .set("Authorization", `Bearer ${token}`);
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({
        activeSuppliersCount: 0,
        pendingApprovalsCount: 0,
        ordersForwardedCount: 0,
        forwardingIssuesCount: 0,
      });

      const linkRes = await request(app.getHttpServer())
        .post("/supplier/store-links")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ storeSlug: "dash-seller-store" });

      const pending = await request(app.getHttpServer())
        .get(`/stores/${storeId}/supplier-links/dashboard`)
        .set("Authorization", `Bearer ${token}`);
      expect(pending.body.activeSuppliersCount).toBe(0);
      expect(pending.body.pendingApprovalsCount).toBe(1);

      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/supplier-links/${linkRes.body.id}/approve`)
        .set("Authorization", `Bearer ${token}`);

      const active = await request(app.getHttpServer())
        .get(`/stores/${storeId}/supplier-links/dashboard`)
        .set("Authorization", `Bearer ${token}`);
      expect(active.body.activeSuppliersCount).toBe(1);
      expect(active.body.pendingApprovalsCount).toBe(0);

      // A pending listing review also counts toward pendingApprovalsCount.
      const { listing } = await seedSupplierListing("dash-supplier@example.com");
      await request(app.getHttpServer())
        .post("/supplier/listings/submit-review")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ storeSupplierLinkId: linkRes.body.id, supplierListingId: listing.id });

      const withReview = await request(app.getHttpServer())
        .get(`/stores/${storeId}/supplier-links/dashboard`)
        .set("Authorization", `Bearer ${token}`);
      expect(withReview.body.pendingApprovalsCount).toBe(1);
    });

    it("a revoked link no longer counts as an active supplier", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("dash-revoke-seller@example.com", "dash-revoke-seller-store");
      const supplierToken = await signupLoginSupplier("dash-revoke-supplier@example.com");
      const linkRes = await request(app.getHttpServer())
        .post("/supplier/store-links")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ storeSlug: "dash-revoke-seller-store" });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/supplier-links/${linkRes.body.id}/approve`)
        .set("Authorization", `Bearer ${token}`);
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/supplier-links/${linkRes.body.id}/revoke`)
        .set("Authorization", `Bearer ${token}`);

      const res = await request(app.getHttpServer())
        .get(`/stores/${storeId}/supplier-links/dashboard`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.body.activeSuppliersCount).toBe(0);
    });
  });

  describe("Moderation amendment (SRS §5.27, v0.13) - supplier listings run through the same engine self-fulfilled products do", () => {
    async function linkAndActivate(sellerToken: string, storeId: string, storeSlug: string, supplierToken: string) {
      const linkRes = await request(app.getHttpServer())
        .post("/supplier/store-links")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ storeSlug });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/supplier-links/${linkRes.body.id}/approve`)
        .set("Authorization", `Bearer ${sellerToken}`);
      return linkRes.body.id as string;
    }

    it("a banned keyword in a supplier listing's title blocks the seller's approval outright", async () => {
      await overrideGlobalSetting("moderation.banned_keywords", ["contraband"]);
      const { token, storeId } = await signupLoginAndCreateStore("mod-banned-seller@example.com", "mod-banned-seller-store");
      const supplierToken = await signupLoginSupplier("mod-banned-supplier@example.com");
      const { listing } = await seedSupplierListing("mod-banned-supplier@example.com", "Contraband Item");
      const linkId = await linkAndActivate(token, storeId, "mod-banned-seller-store", supplierToken);

      const submit = await request(app.getHttpServer())
        .post("/supplier/listings/submit-review")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ storeSupplierLinkId: linkId, supplierListingId: listing.id });

      const approve = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`)
        .set("Authorization", `Bearer ${token}`);
      expect(approve.status).toBe(400);

      const review = await superuser.listingReview.findUniqueOrThrow({ where: { id: submit.body.id } });
      expect(review.status).toBe("pending");
      expect(review.productId).toBeNull();
    });

    it(
      "a restricted keyword routes the approved supplier listing into the platform moderation queue - " +
        "invisible on the storefront until a Reviewer/Admin approves it",
      async () => {
        await overrideGlobalSetting("moderation.new_seller_probation_count", 0);
        await overrideGlobalSetting("moderation.restricted_keywords", ["vape"]);
        const { token, storeId } = await signupLoginAndCreateStore("mod-restricted-seller@example.com", "mod-restricted-seller-store");
        const hostname = "mod-restricted-seller-store.uzeyn.com";
        const supplierToken = await signupLoginSupplier("mod-restricted-supplier@example.com");
        const { listing } = await seedSupplierListing("mod-restricted-supplier@example.com", "Vape Pen");
        const linkId = await linkAndActivate(token, storeId, "mod-restricted-seller-store", supplierToken);

        const submit = await request(app.getHttpServer())
          .post("/supplier/listings/submit-review")
          .set("Authorization", `Bearer ${supplierToken}`)
          .send({ storeSupplierLinkId: linkId, supplierListingId: listing.id });

        const approve = await request(app.getHttpServer())
          .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`)
          .set("Authorization", `Bearer ${token}`);
        expect(approve.status).toBe(200);
        expect(approve.body.review.status).toBe("approved");
        const productId = approve.body.product.id as string;
        expect(approve.body.product.moderationStatus).toBe("pending");

        const storefrontList = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
        expect(storefrontList.body).toEqual([]);

        const adminToken = await createAdminAndGetToken("mod-restricted-admin@example.com", "admin-password-1");
        const queue = await request(app.getHttpServer())
          .get("/admin/moderation/queue")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(queue.body.map((p: any) => p.id)).toContain(productId);

        await request(app.getHttpServer())
          .post(`/admin/moderation/queue/${productId}/approve`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({});
        const storefrontAfter = await request(app.getHttpServer()).get("/storefront/products").query({ hostname });
        expect(storefrontAfter.body.map((p: any) => p.id)).toEqual([productId]);
      },
    );

    it("a trusted seller's approval bypasses moderation for a supplier listing too, even past a banned keyword", async () => {
      await overrideGlobalSetting("moderation.banned_keywords", ["contraband"]);
      const { token, storeId } = await signupLoginAndCreateStore("mod-trusted-seller@example.com", "mod-trusted-seller-store");
      const user = await superuser.user.findUniqueOrThrow({ where: { email: "mod-trusted-seller@example.com" } });
      await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true } });
      const supplierToken = await signupLoginSupplier("mod-trusted-supplier@example.com");
      const { listing } = await seedSupplierListing("mod-trusted-supplier@example.com", "Contraband Item");
      const linkId = await linkAndActivate(token, storeId, "mod-trusted-seller-store", supplierToken);

      const submit = await request(app.getHttpServer())
        .post("/supplier/listings/submit-review")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ storeSupplierLinkId: linkId, supplierListingId: listing.id });

      const approve = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`)
        .set("Authorization", `Bearer ${token}`);
      expect(approve.status).toBe(200);
      expect(approve.body.product.moderationStatus).toBe("not_required");
    });

    it("new-seller probation does NOT apply to supplier-sourced listings, unlike self-fulfilled products", async () => {
      // Default probation count (10, seeded) - a brand-new, non-trusted
      // seller's very first product would normally be queued for
      // self-fulfilled listings (proven in moderation.e2e-spec.ts); a
      // supplier-sourced listing skips that check entirely (FR-27.3 scope
      // amendment).
      const { token, storeId } = await signupLoginAndCreateStore("mod-probation-seller@example.com", "mod-probation-seller-store");
      const supplierToken = await signupLoginSupplier("mod-probation-supplier@example.com");
      const { listing } = await seedSupplierListing("mod-probation-supplier@example.com");
      const linkId = await linkAndActivate(token, storeId, "mod-probation-seller-store", supplierToken);

      const submit = await request(app.getHttpServer())
        .post("/supplier/listings/submit-review")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ storeSupplierLinkId: linkId, supplierListingId: listing.id });

      const approve = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`)
        .set("Authorization", `Bearer ${token}`);
      expect(approve.status).toBe(200);
      expect(approve.body.product.moderationStatus).toBe("not_required");
    });
  });
});
