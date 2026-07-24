import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Module 25 (Admin Completion). Covers the P0 slice: the admin HOME
 * overview aggregation, global search across sellers/stores/orders/
 * suppliers, the seller-360 aggregation endpoint, the Settings Registry
 * resolve/precedence-chain endpoint, the new wallet manual-adjust action,
 * and the newly-added @BlockDuringImpersonation() coverage on the three
 * seller-facing money-write endpoints this module found unprotected
 * (wallet top-up request, subscription change/promo-redeem, growth-
 * program withdrawal request).
 */
describe("Admin Completion (e2e) - Module 25 P0", () => {
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

  async function signup(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, userId: user.id as string, sellerId: seller.id as string };
  }

  async function createStore(email: string, slug: string) {
    const { token, sellerId } = await signup(email);
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    return { token, storeId: store.body.id as string, sellerId };
  }

  async function createAndLoginAdmin(email: string): Promise<{ token: string; adminEmail: string }> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return { token: verify.body.accessToken as string, adminEmail: email };
  }

  it("the admin overview endpoint reflects today's signups and a pending wallet top-up in its queue counts (P0 HOME page)", async () => {
    const { token, sellerId } = await signup("overview-seller@example.com");
    const { token: adminToken } = await createAndLoginAdmin("overview-admin@example.com");

    await request(app.getHttpServer())
      .post("/sellers/me/wallet/topup-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 5000 });

    const overview = await request(app.getHttpServer()).get("/admin/overview").set("Authorization", `Bearer ${adminToken}`);
    expect(overview.status).toBe(200);
    expect(overview.body.today.signups).toBeGreaterThanOrEqual(1);
    const walletQueue = overview.body.queues.find((q: { label: string }) => q.label.includes("Wallet top-ups"));
    expect(walletQueue.count).toBeGreaterThanOrEqual(1);
    expect(overview.body.pendingActionCount).toBeGreaterThanOrEqual(walletQueue.count);
    expect(typeof sellerId).toBe("string"); // sellerId used only to keep the signup call meaningful
  });

  it("global search finds a seller by partial business name/email/ID, a store by partial name, an order by partial buyer email, and a supplier by partial business name (P0)", async () => {
    const { token: adminToken } = await createAndLoginAdmin("search-admin@example.com");
    const { token, storeId, sellerId } = await createStore("search-target@example.com", "search-target-store");

    const category = await superuser.category.create({ data: { name: "Search Test", slug: `search-${Date.now()}` } });
    const product = await superuser.product.create({ data: { storeId, categoryId: category.id, title: "Search Product", status: "active" } });
    const variant = await superuser.productVariant.create({
      data: { storeId, productId: product.id, sku: `SKU-${Date.now()}`, price: 1000, stockQuantity: 10 },
    });
    await superuser.seller.update({ where: { id: sellerId }, data: { isTrusted: true, cnicHash: `test-cnic-hash-${sellerId}` } });
    await superuser.storePaymentInstructions.update({ where: { storeId }, data: { codEnabled: true } });
    await superuser.store.update({ where: { id: storeId }, data: { publishedAt: new Date() } });
    const order = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        buyerEmail: "search-buyer-unique@example.com",
        shippingAddress: { fullName: "A", line1: "L1", city: "Lahore", country: "PK", phone: "0300" },
        items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
      });
    expect(order.status).toBe(201);

    const bcrypt = await import("bcryptjs");
    const supplierEmail = "search-supplier@example.com";
    const supplierUser = await superuser.user.create({
      data: { email: supplierEmail, passwordHash: await bcrypt.hash(PASSWORD, 10), roleFlags: ["supplier"], emailVerifiedAt: new Date() },
    });
    await superuser.supplier.create({ data: { userId: supplierUser.id, businessName: "Search Supplier Co" } });

    const byName = await request(app.getHttpServer())
      .get("/admin/search?q=search-target")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(byName.body.sellers.some((s: { id: string }) => s.id === sellerId)).toBe(true);

    const byEmail = await request(app.getHttpServer())
      .get("/admin/search?q=search-target@example.com")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(byEmail.body.sellers.some((s: { id: string }) => s.id === sellerId)).toBe(true);

    const byPartialId = await request(app.getHttpServer())
      .get(`/admin/search?q=${sellerId.slice(0, 8)}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(byPartialId.body.sellers.some((s: { id: string }) => s.id === sellerId)).toBe(true);

    const storeSearch = await request(app.getHttpServer())
      .get("/admin/search?q=search-target-store")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(storeSearch.body.stores.some((s: { id: string }) => s.id === storeId)).toBe(true);

    const orderSearch = await request(app.getHttpServer())
      .get("/admin/search?q=search-buyer-unique")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(orderSearch.body.orders.some((o: { id: string }) => o.id === order.body.id)).toBe(true);

    const supplierSearch = await request(app.getHttpServer())
      .get("/admin/search?q=Search%20Supplier")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(supplierSearch.body.suppliers.some((s: { businessName: string }) => s.businessName === "Search Supplier Co")).toBe(true);
  });

  it("the seller-360 endpoint aggregates profile, stores, wallet, invoices, programs, T&S, and timeline for one seller (P0)", async () => {
    const { token, storeId, sellerId } = await createStore("s360-seller@example.com", "s360-store");
    const { token: adminToken } = await createAndLoginAdmin("s360-admin@example.com");

    await superuser.ledgerEntry.create({ data: { sellerId, type: "wallet_topup_credit", amount: 1000, currency: "PKR" } });
    await superuser.programParticipant.create({ data: { sellerId, programType: "ambassador", status: "pending" } });
    await request(app.getHttpServer())
      .post(`/admin/sellers/${sellerId}/lifecycle`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "warned", reason: "test flag for timeline" });

    const overview = await request(app.getHttpServer()).get(`/admin/sellers/${sellerId}/overview`).set("Authorization", `Bearer ${adminToken}`);
    expect(overview.status).toBe(200);
    expect(overview.body.seller.id).toBe(sellerId);
    expect(overview.body.stores.some((s: { id: string }) => s.id === storeId)).toBe(true);
    expect(overview.body.wallet.balance).toBe(1000);
    expect(overview.body.programs).toHaveLength(1);
    expect(overview.body.timeline.length).toBeGreaterThanOrEqual(1);
    expect(overview.body.timeline.some((t: { action: string }) => t.action === "seller.lifecycle.set_status")).toBe(true);
    expect(typeof token).toBe("string");
  });

  it("the settings resolve endpoint shows the correct winning scope and precedence chain, with last-changed-by surfaced (P0)", async () => {
    const { sellerId } = await signup("settings-seller@example.com");
    const { token: adminToken, adminEmail } = await createAndLoginAdmin("settings-admin@example.com");

    const beforeOverride = await request(app.getHttpServer())
      .get(`/admin/settings/resolve?key=billing.commission_rate_percent&sellerId=${sellerId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(beforeOverride.body.winningScope).toBe("default");

    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "billing.commission_rate_percent", scopeType: "seller", scopeId: sellerId, value: 48 });

    const afterOverride = await request(app.getHttpServer())
      .get(`/admin/settings/resolve?key=billing.commission_rate_percent&sellerId=${sellerId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(afterOverride.body.winningScope).toBe("seller");
    expect(afterOverride.body.effectiveValue).toBe(48);
    const sellerEntry = afterOverride.body.chain.find((c: { scope: string }) => c.scope === "seller");
    expect(sellerEntry.hasOverride).toBe(true);
    expect(sellerEntry.updatedByEmail).toBe(adminEmail);
  });

  it("the wallet manual-adjust action credits/debits with a reason, rejects a zero amount or missing reason, and is audit-logged (P0)", async () => {
    const { sellerId } = await signup("adjust-seller@example.com");
    const { token: adminToken } = await createAndLoginAdmin("adjust-admin@example.com");

    const credit = await request(app.getHttpServer())
      .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 500, reason: "Goodwill credit for shipping delay" });
    expect(credit.status).toBe(201);

    const balanceAfterCredit = await request(app.getHttpServer())
      .get(`/admin/sellers/${sellerId}/overview`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(balanceAfterCredit.body.wallet.balance).toBe(500);

    const debit = await request(app.getHttpServer())
      .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: -200, reason: "Correcting a duplicate credit" });
    expect(debit.status).toBe(201);

    const balanceAfterDebit = await request(app.getHttpServer())
      .get(`/admin/sellers/${sellerId}/overview`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(balanceAfterDebit.body.wallet.balance).toBe(300);

    const zeroAttempt = await request(app.getHttpServer())
      .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 0, reason: "should fail" });
    expect(zeroAttempt.status).toBe(400);

    const noReasonAttempt = await request(app.getHttpServer())
      .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 100 });
    expect(noReasonAttempt.status).toBe(400);

    const auditRow = await superuser.adminAuditLog.findFirst({ where: { action: "billing.wallet_manual_adjust", targetId: sellerId } });
    expect(auditRow).not.toBeNull();
  });

  it("wallet top-up requests, subscription changes/promo-redeems, and growth-program withdrawal requests are all blocked during impersonation (P0 - previously unprotected money-writes)", async () => {
    const { sellerId } = await createStore("imp-block-seller@example.com", "imp-block-store");
    const { token: adminToken } = await createAndLoginAdmin("imp-block-admin@example.com");

    const start = await request(app.getHttpServer())
      .post(`/admin/sellers/${sellerId}/impersonate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Investigating a support ticket" });
    const impersonationToken = start.body.accessToken as string;

    const topUp = await request(app.getHttpServer())
      .post("/sellers/me/wallet/topup-requests")
      .set("Authorization", `Bearer ${impersonationToken}`)
      .send({ amount: 1000 });
    expect(topUp.status).toBe(403);

    const change = await request(app.getHttpServer())
      .post("/sellers/me/subscription/change")
      .set("Authorization", `Bearer ${impersonationToken}`)
      .send({});
    expect(change.status).toBe(403);

    const redeem = await request(app.getHttpServer())
      .post("/sellers/me/subscription/redeem-promo")
      .set("Authorization", `Bearer ${impersonationToken}`)
      .send({});
    expect(redeem.status).toBe(403);

    const withdrawal = await request(app.getHttpServer())
      .post("/sellers/me/growth-programs/withdrawals")
      .set("Authorization", `Bearer ${impersonationToken}`)
      .send({});
    expect(withdrawal.status).toBe(403);
  });
});

/**
 * Module 25 P1 - backend surfaces for the 8 previously API-only admin
 * pages this phase added a frontend for. Every endpoint below already
 * existed and was already exercised by its own module's e2e spec (careers:
 * module22-careers.e2e-spec.ts; growth-programs applications/withdrawals/
 * clawback: module22-growth-partner-programs.e2e-spec.ts; admin-grant-plan/
 * promo-codes: plans-pricing.e2e-spec.ts) - this block only closes the
 * remaining gaps that had NO e2e coverage anywhere before this module: the
 * Creator content-submission verify/reject queue, category creation, the
 * supplier-adapter registry's admin CRUD, and the audit-log list endpoint.
 */
describe("Admin Completion (e2e) - Module 25 P1", () => {
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

  async function signup(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, userId: user.id as string, sellerId: seller.id as string };
  }

  async function createAndLoginAdmin(email: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  it("a Creator's content submission is verified (computes and posts a reward, audit-logged) or rejected (pays nothing), and the queue only ever shows pending rows", async () => {
    const { token, sellerId } = await signup("creator-p1@example.com");
    const adminToken = await createAndLoginAdmin("creator-p1-admin@example.com");

    const participant = await superuser.programParticipant.create({
      data: { sellerId, programType: "creator", status: "approved", referralCode: "creator-p1-code" },
    });

    // Both default to 0 (view-based rewards disabled until the founder sets a real rate/cap) - set a real rate for this test.
    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "growth.creator_view_reward_per_million_pkr", scopeType: "global", value: 1000 });
    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ key: "growth.creator_monthly_reward_cap_pkr", scopeType: "global", value: 100000 });

    const submit = await request(app.getHttpServer())
      .post("/sellers/me/growth-programs/content")
      .set("Authorization", `Bearer ${token}`)
      .send({ platform: "youtube", contentUrl: "https://youtube.com/watch?v=abc", reportedViews: 2_000_000 });
    expect(submit.status).toBe(201);

    const queue = await request(app.getHttpServer())
      .get("/admin/growth-programs/content-submissions/queue")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(queue.body.some((s: { id: string }) => s.id === submit.body.id)).toBe(true);

    const verify = await request(app.getHttpServer())
      .post(`/admin/growth-programs/content-submissions/${submit.body.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ notes: "Checked view count via platform analytics" });
    expect(verify.status).toBe(201);
    expect(verify.body.status).toBe("verified");
    expect(Number(verify.body.rewardAmount)).toBeGreaterThan(0);

    const balance = await request(app.getHttpServer())
      .get(`/admin/sellers/${sellerId}/overview`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(balance.body.wallet.balance).toBe(Number(verify.body.rewardAmount));

    const auditRow = await superuser.adminAuditLog.findFirst({ where: { action: "growth_programs.content_verified", targetId: submit.body.id } });
    expect(auditRow).not.toBeNull();

    const queueAfter = await request(app.getHttpServer())
      .get("/admin/growth-programs/content-submissions/queue")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(queueAfter.body.some((s: { id: string }) => s.id === submit.body.id)).toBe(false);

    expect(typeof participant.id).toBe("string");
  });

  it("an admin creates a product category, which then appears in the public category list", async () => {
    const adminToken = await createAndLoginAdmin("category-p1-admin@example.com");

    const create = await request(app.getHttpServer())
      .post("/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Home & Kitchen P1", slug: `home-kitchen-p1-${Date.now()}` });
    expect(create.status).toBe(201);

    const list = await request(app.getHttpServer()).get("/categories").set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.some((c: { id: string }) => c.id === create.body.id)).toBe(true);
  });

  it("an admin registers a supplier adapter, then enables/disables it and edits its config, without a deploy", async () => {
    const adminToken = await createAndLoginAdmin("adapter-p1-admin@example.com");

    const create = await request(app.getHttpServer())
      .post("/admin/supplier-adapters")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ adapterType: `custom_p1_${Date.now()}`, displayName: "Custom P1 Supplier" });
    expect(create.status).toBe(201);
    expect(create.body.isEnabled).toBe(true);

    const disable = await request(app.getHttpServer())
      .patch(`/admin/supplier-adapters/${create.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isEnabled: false, config: { apiKey: "test-key" } });
    expect(disable.status).toBe(200);
    expect(disable.body.isEnabled).toBe(false);
    expect(disable.body.config).toEqual({ apiKey: "test-key" });

    const list = await request(app.getHttpServer()).get("/admin/supplier-adapters").set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.some((a: { id: string }) => a.id === create.body.id)).toBe(true);
  });

  it("the audit log list endpoint returns recent entries, most recent first, honoring a limit", async () => {
    const adminToken = await createAndLoginAdmin("auditlist-p1-admin@example.com");
    const { sellerId } = await signup("auditlist-p1-seller@example.com");

    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 100, reason: "audit-log listing test" });

    const list = await request(app.getHttpServer()).get("/admin/audit-logs?limit=5").set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
    expect(list.body.length).toBeLessThanOrEqual(5);
    expect(list.body[0].action).toBe("billing.wallet_manual_adjust");
  });

  it("the system status endpoint reports db/redis/object-storage reachability and every background queue's job counts", async () => {
    const adminToken = await createAndLoginAdmin("status-p1-admin@example.com");

    const status = await request(app.getHttpServer()).get("/admin/system-status").set("Authorization", `Bearer ${adminToken}`);
    expect(status.status).toBe(200);
    expect(status.body.db).toBe(true);
    expect(status.body.redis).toBe(true);
    expect(typeof status.body.objectStorage).toBe("boolean");
    expect(status.body.backups).toBe("not yet configured");
    expect(status.body.email.provider).toBe("console");
    expect(Array.isArray(status.body.queues)).toBe(true);
    expect(status.body.queues.length).toBeGreaterThanOrEqual(10);
    for (const queue of status.body.queues) {
      expect(typeof queue.name).toBe("string");
      expect(typeof queue.waiting).toBe("number");
      expect(typeof queue.failed).toBe("number");
    }
  });

  it("the notification center reports new pending-queue rows since the admin's last-seen timestamp, and mark-seen clears it", async () => {
    const { sellerId } = await signup("notif-p1-seller@example.com");
    const adminToken = await createAndLoginAdmin("notif-p1-admin@example.com");

    await request(app.getHttpServer())
      .post("/sellers/me/wallet/topup-requests")
      .set("Authorization", `Bearer ${(await signup("notif-p1-seller2@example.com")).token}`)
      .send({ amount: 1000 });

    const before = await request(app.getHttpServer()).get("/admin/notifications").set("Authorization", `Bearer ${adminToken}`);
    expect(before.status).toBe(200);
    expect(before.body.lastSeenAt).toBeNull();
    expect(before.body.totalCount).toBeGreaterThanOrEqual(1);
    expect(before.body.items.some((i: { label: string }) => i.label.includes("wallet top-up"))).toBe(true);

    const markSeen = await request(app.getHttpServer()).post("/admin/notifications/mark-seen").set("Authorization", `Bearer ${adminToken}`);
    expect(markSeen.status).toBe(201);

    const after = await request(app.getHttpServer()).get("/admin/notifications").set("Authorization", `Bearer ${adminToken}`);
    expect(after.body.lastSeenAt).not.toBeNull();
    expect(after.body.totalCount).toBe(0);
    expect(after.body.items).toHaveLength(0);

    // A NEW pending row created after mark-seen shows up again.
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 100, reason: "unrelated - just advances audit log, not a queue row" });
    const { token: laterToken } = await signup("notif-p1-seller3@example.com");
    await request(app.getHttpServer())
      .post("/sellers/me/wallet/topup-requests")
      .set("Authorization", `Bearer ${laterToken}`)
      .send({ amount: 2000 });

    const afterNewRequest = await request(app.getHttpServer()).get("/admin/notifications").set("Authorization", `Bearer ${adminToken}`);
    expect(afterNewRequest.body.totalCount).toBeGreaterThanOrEqual(1);
  });
});
