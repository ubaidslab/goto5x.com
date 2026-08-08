import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { WalletGraceLadderService } from "../../src/billing/wallet-grace-ladder.service";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedLedgerEntry, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

const shippingAddress = {
  fullName: "Bilal Ahmed",
  line1: "House 7, Street 2",
  city: "Karachi",
  country: "PK",
  phone: "03001234567",
};

/**
 * Module 20 (SRS §5.6e/FR-6.21-6.28, revised FR-7.2, FR-7.10 supplement),
 * §14.6e. Prepaid Credits Wallet - the wallet replaces §5.6c's monthly
 * invoicing as v1.0's active mechanism.
 */
describe("Prepaid Credits Wallet + Supplier Portal Completion (e2e) - SRS §5.6e, §14.6e, FR-7.10", () => {
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

  async function createUnpublishedStore(email: string, slug: string) {
    const { token, sellerId } = await signup(email);
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    return { token, storeId: store.body.id as string, sellerId };
  }

  async function makeReadyExceptWallet(token: string, storeId: string, sellerId: string) {
    await superuser.storePaymentInstructions.update({ where: { storeId }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: sellerId }, data: { cnicHash: `hash-${sellerId}` } });
  }

  async function signupLoginAndCreatePublishedStore(email: string, slug: string) {
    const { token, storeId, sellerId } = await createUnpublishedStore(email, slug);
    await makeReadyExceptWallet(token, storeId, sellerId);
    await superuser.store.update({ where: { id: storeId }, data: { publishedAt: new Date() } });
    // v0.35/FR-6.30 - every plan's commissionPercent override is now
    // seeded at 0% (UZEYN is subscription-only); this module tests the
    // commission-debit/negative-float mechanics themselves, which need a
    // nonzero rate to exercise, so a seller-scoped override (highest
    // precedence, beats First Month's own now-zeroed plan-scoped
    // override) is set for every seller this helper creates.
    await app.get(SettingsService).setValue("billing.commission_rate_percent", "seller", sellerId, 2, ADMIN_ID);
    return { token, storeId, sellerId };
  }

  async function createAndLoginAdmin(email: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  async function topUpAndVerify(token: string, adminToken: string, amount: number) {
    const req = await request(app.getHttpServer())
      .post("/sellers/me/wallet/topup-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount });
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/${req.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
  }

  async function addProduct(token: string, storeId: string, price: number) {
    const category = await superuser.category.create({ data: { name: "Wallet Test", slug: `wallet-${Date.now()}-${Math.random()}` } });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Wallet Product", categoryId: category.id, status: "active" });
    await superuser.product.update({ where: { id: product.body.id }, data: { moderationStatus: "approved" } });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `WAL-${Date.now()}`, price, stockQuantity: 10 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function createAndPayManualOrder(token: string, storeId: string, productId: string, variantId: string) {
    const order = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        buyerEmail: "buyer@example.com",
        shippingAddress,
        items: [{ productId, variantId, quantity: 1 }],
      });
    return order;
  }

  describe("Publish gate (FR-6.21)", () => {
    it("cannot go live without payment method, CNIC, and a minimum wallet top-up - all three", async () => {
      const { token, storeId, sellerId } = await createUnpublishedStore("publish-gate@example.com", "publish-gate-store");
      const adminToken = await createAndLoginAdmin("publish-gate-admin@example.com");

      // Signup/store creation itself required no wallet interaction.
      const balanceBeforeAnything = await request(app.getHttpServer())
        .get("/sellers/me/wallet")
        .set("Authorization", `Bearer ${token}`);
      expect(balanceBeforeAnything.body.balance).toBe(0);

      const noPaymentMethod = await request(app.getHttpServer())
        .post(`/stores/${storeId}/publish`)
        .set("Authorization", `Bearer ${token}`);
      expect(noPaymentMethod.status).toBe(400);

      await superuser.storePaymentInstructions.update({ where: { storeId }, data: { codEnabled: true } });
      const noCnic = await request(app.getHttpServer())
        .post(`/stores/${storeId}/publish`)
        .set("Authorization", `Bearer ${token}`);
      expect(noCnic.status).toBe(400);

      await superuser.seller.update({ where: { id: sellerId }, data: { cnicHash: `hash-${sellerId}` } });
      const noTopUp = await request(app.getHttpServer())
        .post(`/stores/${storeId}/publish`)
        .set("Authorization", `Bearer ${token}`);
      expect(noTopUp.status).toBe(400);

      await topUpAndVerify(token, adminToken, 500);
      const published = await request(app.getHttpServer())
        .post(`/stores/${storeId}/publish`)
        .set("Authorization", `Bearer ${token}`);
      expect(published.status).toBe(201);
      expect(published.body.publishedAt).toBeTruthy();
    });

    it("blocks checkout on an unpublished store even with payment method + CNIC configured", async () => {
      const { token, storeId, sellerId } = await createUnpublishedStore("unpub-checkout@example.com", "unpub-checkout-store");
      await makeReadyExceptWallet(token, storeId, sellerId);
      const { productId, variantId } = await addProduct(token, storeId, 500);

      const blocked = await createAndPayManualOrder(token, storeId, productId, variantId);
      expect(blocked.status).toBe(400);
    });
  });

  describe("Top-up + commission debit (FR-6.22/6.23, Financial Truth Invariant)", () => {
    it("a verified top-up credits the wallet, audit-logged; marking an order paid debits commission - never a pending order", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreatePublishedStore("wallet-flow@example.com", "wallet-flow-store");
      const adminToken = await createAndLoginAdmin("wallet-flow-admin@example.com");
      await topUpAndVerify(token, adminToken, 1000);

      const balanceAfterTopUp = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
      expect(balanceAfterTopUp.body.balance).toBe(1000);

      const auditRow = await superuser.adminAuditLog.findFirst({ where: { action: "billing.wallet_topup_verified" } });
      expect(auditRow).not.toBeNull();

      const { productId, variantId } = await addProduct(token, storeId, 500);
      const order = await createAndPayManualOrder(token, storeId, productId, variantId);
      expect(order.status).toBe(201);

      // Financial Truth Invariant - still pending, no commission debit yet.
      const balanceWhilePending = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
      expect(balanceWhilePending.body.balance).toBe(1000);

      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${order.body.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);

      const balanceAfterSale = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
      expect(balanceAfterSale.body.balance).toBe(990); // First Month's 2% of 500 (v0.33 signup default)

      const history = await request(app.getHttpServer())
        .get("/sellers/me/wallet/transactions")
        .set("Authorization", `Bearer ${token}`);
      expect(history.body.items.some((t: { label: string }) => t.label === "Top-up verified")).toBe(true);
      expect(history.body.items.some((t: { label: string }) => t.label.startsWith("Commission"))).toBe(true);
    });
  });

  describe("Wallet transaction history pagination (Phase B pre-launch audit finding)", () => {
    it("getTransactionHistory() paginates instead of returning every entry, newest first", async () => {
      const { token } = await signupLoginAndCreatePublishedStore("wallet-page@example.com", "wallet-page-store");
      const adminToken = await createAndLoginAdmin("wallet-page-admin@example.com");

      // 5 distinct-amount top-ups, sequential so createdAt strictly increases.
      for (const amount of [100, 200, 300, 400, 500]) {
        await topUpAndVerify(token, adminToken, amount);
      }

      const page1 = await request(app.getHttpServer())
        .get("/sellers/me/wallet/transactions?page=1&limit=2")
        .set("Authorization", `Bearer ${token}`);
      expect(page1.body.total).toBe(5);
      expect(page1.body.totalPages).toBe(3);
      expect(page1.body.page).toBe(1);
      expect(page1.body.limit).toBe(2);
      expect(page1.body.items).toHaveLength(2);
      // Newest first - the last two top-ups verified (500, 400).
      expect(page1.body.items.map((t: { amount: number }) => t.amount)).toEqual([500, 400]);

      const page2 = await request(app.getHttpServer())
        .get("/sellers/me/wallet/transactions?page=2&limit=2")
        .set("Authorization", `Bearer ${token}`);
      expect(page2.body.items.map((t: { amount: number }) => t.amount)).toEqual([300, 200]);
      // No overlap between pages.
      const page1Ids = page1.body.items.map((t: { id: string }) => t.id);
      const page2Ids = page2.body.items.map((t: { id: string }) => t.id);
      expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);

      const page3 = await request(app.getHttpServer())
        .get("/sellers/me/wallet/transactions?page=3&limit=2")
        .set("Authorization", `Bearer ${token}`);
      expect(page3.body.items).toHaveLength(1);
      expect(page3.body.items[0].amount).toBe(100);

      // Past the last page - empty, not an error, still correct total/totalPages.
      const page4 = await request(app.getHttpServer())
        .get("/sellers/me/wallet/transactions?page=4&limit=2")
        .set("Authorization", `Bearer ${token}`);
      expect(page4.body.items).toHaveLength(0);
      expect(page4.body.total).toBe(5);
      expect(page4.body.totalPages).toBe(3);
    });
  });

  describe("Negative-float / mid-flight sale safety (FR-6.26)", () => {
    it("a confirmed sale's commission debit succeeds even when it takes the balance negative, within the configured floor", async () => {
      const { token, storeId } = await signupLoginAndCreatePublishedStore("mid-flight@example.com", "mid-flight-store");
      const { productId, variantId } = await addProduct(token, storeId, 50);
      // Balance is 0 here (no top-up) - a real seller could never have
      // published without one, but this proves the debit itself never
      // blocks regardless of the resulting balance (FR-6.26's guarantee).
      const order = await createAndPayManualOrder(token, storeId, productId, variantId);
      expect(order.status).toBe(201);

      const markPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${order.body.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      expect(markPaid.status).toBe(201);

      const balance = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
      expect(balance.body.balance).toBe(-1); // First Month's 2% of 50, taken from a zero balance
    });

    it("a sale that drives the balance below the floor pauses stores immediately, without waiting for grace to expire; a verified top-up restores (FR-6.26 fix)", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreatePublishedStore("floor-breach@example.com", "floor-breach-store");
      const adminToken = await createAndLoginAdmin("floor-breach-admin@example.com");
      const settings = app.get(SettingsService);
      // A tight floor. No sweep ever runs in this test - the pause must
      // come from markAsPaid's own immediate floor check, never the
      // gentler warn-then-grace ladder (which only a sweep can trigger).
      await settings.setValue("billing.wallet_negative_float_floor", "global", null, -1, ADMIN_ID);

      const { productId, variantId } = await addProduct(token, storeId, 200);
      const order = await createAndPayManualOrder(token, storeId, productId, variantId);
      expect(order.status).toBe(201);

      const markPaid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${order.body.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);
      // The debit itself never fails, even though it crosses the floor.
      expect(markPaid.status).toBe(201);

      const balance = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
      expect(balance.body.balance).toBe(-4); // First Month's 2% of 200, taken from a zero balance - below the -1 floor

      // Paused immediately by markAsPaid itself - no sweep was ever run.
      const pausedStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(pausedStore.status).toBe("orders_paused");

      const pauseEvent = await superuser.platformEvent.findFirst({ where: { eventType: "wallet.orders_paused", entityId: sellerId } });
      expect(pauseEvent).not.toBeNull();

      const storefrontRead = await request(app.getHttpServer()).get("/storefront/products?hostname=floor-breach-store.uzeyn.com");
      expect(storefrontRead.status).toBe(200);

      const blockedOrder = await createAndPayManualOrder(token, storeId, productId, variantId);
      expect(blockedOrder.status).toBe(400);

      await topUpAndVerify(token, adminToken, 500);
      const restoredStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(restoredStore.status).toBe("active");
    });
  });

  describe("Low-balance grace ladder + orders_paused (FR-6.25)", () => {
    it("warns, then pauses orders after the grace period, then restores instantly on a verified top-up - never overwriting an admin suspension", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreatePublishedStore("grace-ladder@example.com", "grace-ladder-store");
      const adminToken = await createAndLoginAdmin("grace-ladder-admin@example.com");
      const settings = app.get(SettingsService);
      await settings.setValue("billing.wallet_low_balance_warning_threshold", "global", null, 100, ADMIN_ID);
      await settings.setValue("billing.wallet_grace_days", "global", null, 3, ADMIN_ID);

      // Balance is 0, already below the 100 threshold.
      const graceLadder = app.get(WalletGraceLadderService);
      const firstSweep = await graceLadder.runSweep(new Date());
      expect(firstSweep.warned).toBe(1);

      const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
      expect(seller.walletLowBalanceWarningSentAt).not.toBeNull();

      const storeStillActive = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(storeStillActive.status).toBe("active");

      // Simulate the grace period having elapsed.
      const fourDaysLater = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
      const secondSweep = await graceLadder.runSweep(fourDaysLater);
      expect(secondSweep.paused).toBe(1);

      const pausedStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(pausedStore.status).toBe("orders_paused");

      // Storefront browsing stays open; checkout is blocked.
      const storefrontRead = await request(app.getHttpServer()).get("/storefront/products?hostname=grace-ladder-store.uzeyn.com");
      expect(storefrontRead.status).toBe(200);

      const { productId, variantId } = await addProduct(token, storeId, 100);
      const blockedOrder = await createAndPayManualOrder(token, storeId, productId, variantId);
      expect(blockedOrder.status).toBe(400);

      // A verified top-up restores instantly, no admin action beyond verification.
      await topUpAndVerify(token, adminToken, 500);
      const restoredStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(restoredStore.status).toBe("active");

      // orders_paused never clobbers an independently admin-issued suspension.
      await superuser.store.update({ where: { id: storeId }, data: { status: "suspended" } });
      await settings.setValue("billing.wallet_low_balance_warning_threshold", "global", null, 10000, ADMIN_ID);
      const thirdSweep = await graceLadder.runSweep(new Date());
      const stillSuspended = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(stillSuspended.status).toBe("suspended");
      expect(thirdSweep.paused).toBe(0);
    });
  });

  describe("Plan fee / team seat / device slot wallet debits (FR-6.24, revised v0.33 FR-7.2)", () => {
    it("debits a paid plan's fee monthly; insufficient balance pauses orders (never a Free-Plan reassignment - there is no more Free Plan)", async () => {
      const { token, storeId, sellerId } = await signupLoginAndCreatePublishedStore("plan-fee@example.com", "plan-fee-store");
      const adminToken = await createAndLoginAdmin("plan-fee-admin@example.com");
      await topUpAndVerify(token, adminToken, 5000);

      // Every seller starts on First Month (v0.33) - already a real, paid,
      // tracked billing cycle, so no plan change is needed to exercise the
      // fee-debit sweep.
      const planFeeDebit = app.get(PlanFeeDebitService);
      const aMonthLater = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      const firstSweep = await planFeeDebit.runMonthlyDebitSweep(aMonthLater);
      expect(firstSweep.debited).toBeGreaterThanOrEqual(1);

      const balanceAfterFee = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
      expect(balanceAfterFee.body.balance).toBeLessThan(5000);

      // Drain the wallet, then let the next cycle's fee hit an empty wallet.
      const subscriptionRow = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      const planBeforeShortfall = subscriptionRow.planId;
      await superuser.subscription.update({
        where: { id: subscriptionRow.id },
        data: { currentPeriodEnd: aMonthLater },
      });
      // Spend the whole balance on commission so nothing is left for the fee.
      const balance = (await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`)).body.balance;
      await seedLedgerEntry(superuser, { sellerId, type: "wallet_plan_fee_debit", amount: balance, currency: "PKR" });

      const secondCycle = new Date(aMonthLater.getTime() + 31 * 24 * 60 * 60 * 1000);
      const secondSweep = await planFeeDebit.runMonthlyDebitSweep(secondCycle);
      expect(secondSweep.downgraded).toBeGreaterThanOrEqual(1); // v0.33: counts stores paused, not plans downgraded

      // The subscription stays on the exact same plan - never reassigned,
      // since there is no more Free Plan to fall back to.
      const afterShortfall = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
      expect(afterShortfall.planId).toBe(planBeforeShortfall);

      // Insufficient plan-fee balance now pauses orders via the same
      // mechanism as the wallet low-balance grace ladder
      // (WalletGraceLadderService.pauseActiveStores()) - unified per the
      // founder's explicit instruction.
      const store = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
      expect(store.status).toBe("orders_paused");
    });
  });

  describe("Supplier wallet isolation (FR-7.10 supplement)", () => {
    it("a supplier's Premium-tier fee debits its own wallet, never any linked seller's wallet", async () => {
      const supplierEmail = "wallet-supplier@example.com";
      await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: supplierEmail, password: PASSWORD, businessName: "Wallet Supplier Co", role: "supplier" });
      const supplierLogin = await request(app.getHttpServer()).post("/auth/login").send({ email: supplierEmail, password: PASSWORD });
      const supplierToken = supplierLogin.body.accessToken as string;

      const subBefore = await request(app.getHttpServer())
        .get("/suppliers/me/subscription")
        .set("Authorization", `Bearer ${supplierToken}`);
      expect(subBefore.status).toBe(200);

      const premiumPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "supplier", tierOrder: 1 } });
      await request(app.getHttpServer())
        .post("/suppliers/me/subscription/change")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ planId: premiumPlan.id });

      const adminToken = await createAndLoginAdmin("wallet-supplier-admin@example.com");
      const topUp = await request(app.getHttpServer())
        .post("/suppliers/me/wallet/topup-requests")
        .set("Authorization", `Bearer ${supplierToken}`)
        .send({ amount: 3000 });
      await request(app.getHttpServer())
        .post(`/admin/wallet-topups/${topUp.body.request.id}/verify`)
        .set("Authorization", `Bearer ${adminToken}`);

      const balance = await request(app.getHttpServer()).get("/suppliers/me/wallet").set("Authorization", `Bearer ${supplierToken}`);
      expect(balance.body.balance).toBe(3000);

      const supplierRow = await superuser.supplier.findFirstOrThrow({ where: { user: { email: supplierEmail } } });
      const supplierSubscription = await superuser.subscription.findUniqueOrThrow({ where: { supplierId: supplierRow.id } });
      await superuser.subscription.update({
        where: { id: supplierSubscription.id },
        data: { currentPeriodEnd: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000) },
      });

      const planFeeDebit = app.get(PlanFeeDebitService);
      const aMonthLater = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000);
      await planFeeDebit.runMonthlyDebitSweep(aMonthLater);

      const balanceAfterFee = await request(app.getHttpServer()).get("/suppliers/me/wallet").set("Authorization", `Bearer ${supplierToken}`);
      expect(balanceAfterFee.body.balance).toBeLessThan(3000);

      // No seller wallet exists to have been touched by this - the supplier
      // wallet is a wholly separate table (SupplierWalletEntry).
      const anySellerLedgerEntries = await superuser.ledgerEntry.count();
      expect(anySellerLedgerEntries).toBe(0);
    });

    it("a free-tier supplier linked to more than one store must filter to a single store; Premium unlocks the aggregated view", async () => {
      const supplierEmail = "multi-store-supplier@example.com";
      await request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: supplierEmail, password: PASSWORD, businessName: "Multi Store Supplier", role: "supplier" });
      const supplierLogin = await request(app.getHttpServer()).post("/auth/login").send({ email: supplierEmail, password: PASSWORD });
      const supplierToken = supplierLogin.body.accessToken as string;
      const supplierRow = await superuser.supplier.findFirstOrThrow({ where: { user: { email: supplierEmail } } });

      const storeA = await signupLoginAndCreatePublishedStore("multi-store-seller-a@example.com", "multi-store-a");
      const storeB = await signupLoginAndCreatePublishedStore("multi-store-seller-b@example.com", "multi-store-b");
      await superuser.storeSupplierLink.create({ data: { storeId: storeA.storeId, supplierId: supplierRow.id, invitedBy: "supplier", status: "active" } });
      await superuser.storeSupplierLink.create({ data: { storeId: storeB.storeId, supplierId: supplierRow.id, invitedBy: "supplier", status: "active" } });

      const blockedAggregate = await request(app.getHttpServer())
        .get("/supplier/orders")
        .set("Authorization", `Bearer ${supplierToken}`);
      expect(blockedAggregate.status).toBe(400);

      const singleStoreOk = await request(app.getHttpServer())
        .get(`/supplier/orders?storeId=${storeA.storeId}`)
        .set("Authorization", `Bearer ${supplierToken}`);
      expect(singleStoreOk.status).toBe(200);

      const premiumPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "supplier", tierOrder: 1 } });
      await app.get(SettingsService).setValue("suppliers.aggregated_dashboard_enabled", "plan", premiumPlan.id, true, ADMIN_ID);
      await superuser.subscription.update({ where: { supplierId: supplierRow.id }, data: { planId: premiumPlan.id } });

      const aggregateNowOk = await request(app.getHttpServer())
        .get("/supplier/orders")
        .set("Authorization", `Bearer ${supplierToken}`);
      expect(aggregateNowOk.status).toBe(200);
    });
  });

  describe("Dormant invoicing mechanism (FR-6.28)", () => {
    it("the old commission-invoice generation job produces no new rows going forward (unscheduled, not deleted)", async () => {
      const { token, storeId } = await signupLoginAndCreatePublishedStore("dormant-invoice@example.com", "dormant-invoice-store");
      const adminToken = await createAndLoginAdmin("dormant-invoice-admin@example.com");
      await topUpAndVerify(token, adminToken, 1000);
      const { productId, variantId } = await addProduct(token, storeId, 500);
      const order = await createAndPayManualOrder(token, storeId, productId, variantId);
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${order.body.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`);

      // InvoicesService.generateMonthlyInvoices() itself is preserved and
      // still callable (FR-6.28's "unscheduled, not deleted") - it's simply
      // never invoked by anything now that commission debits the wallet
      // directly, so no seller_invoices row is ever created going forward.
      const invoicesCount = await superuser.sellerInvoice.count();
      expect(invoicesCount).toBe(0);

      // The admin verification screen was repurposed (FR-6.23): the same
      // /admin/invoices route now serves wallet top-up requests, not invoices.
      const repurposedRoute = await request(app.getHttpServer())
        .get("/admin/wallet-topups")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(repurposedRoute.status).toBe(200);
    });
  });
});
