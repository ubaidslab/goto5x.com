import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { WalletService } from "../../src/billing/wallet.service";
import { WalletReconciliationService } from "../../src/billing/wallet-reconciliation.service";
import { round2 } from "../../src/orders/money.util";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

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
 * Module 47 (SRS §5.6e, FR-6.21 amended v0.33, new FR-6.29). The wallet
 * balance becomes a maintained WalletBalance.balance running-total cache,
 * updated atomically (via Prisma's `increment`, in the SAME transaction as
 * every LedgerEntry insert) instead of re-aggregated from scratch on every
 * read. This suite is founder-mandated as the highest-risk change in the
 * deep-audit Phase A batch - it touches money - so it proves each of the
 * five explicit requirements directly, not just that the happy path works.
 */
describe("Wallet Balance Reconciliation (e2e) - SRS §5.6e, new FR-6.29", () => {
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

  async function signupLoginAndCreatePublishedStore(email: string, slug: string) {
    const { token, sellerId } = await signup(email);
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    const storeId = store.body.id as string;
    await superuser.storePaymentInstructions.update({ where: { storeId }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: sellerId }, data: { cnicHash: `hash-${sellerId}` } });
    await superuser.store.update({ where: { id: storeId }, data: { publishedAt: new Date() } });
    // v0.35/FR-6.30 - every plan's commissionPercent override is now
    // seeded at 0% (UZEYN is subscription-only); this module tests
    // wallet-balance/ledger mechanics that need a real nonzero commission
    // debit to exercise, so a seller-scoped override (highest precedence,
    // beats the plan's own now-zeroed override) is set for every seller
    // this helper creates.
    await app
      .get(SettingsService)
      .setValue("billing.commission_rate_percent", "seller", sellerId, 2, ADMIN_ID);
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
    const category = await superuser.category.create({ data: { name: "Wallet Test", slug: `wallet47-${Date.now()}-${Math.random()}` } });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Wallet Test Product", categoryId: category.id, status: "active" });
    await superuser.product.update({ where: { id: product.body.id }, data: { moderationStatus: "approved" } });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `WAL47-${Date.now()}-${Math.random()}`, price, stockQuantity: 1000 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function createManualOrder(token: string, storeId: string, productId: string, variantId: string) {
    return request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({ buyerEmail: "buyer@example.com", shippingAddress, items: [{ productId, variantId, quantity: 1 }] });
  }

  async function getBalance(token: string): Promise<number> {
    const res = await request(app.getHttpServer()).get("/sellers/me/wallet").set("Authorization", `Bearer ${token}`);
    return res.body.balance as number;
  }

  it("balance is correct after a mix of credits and debits, and matches an independent from-scratch ledger recomputation", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreatePublishedStore("mixed-ledger@example.com", "mixed-ledger-store");
    const adminToken = await createAndLoginAdmin("mixed-ledger-admin@example.com");

    await topUpAndVerify(token, adminToken, 1000); // credit: +1000
    const { productId, variantId } = await addProduct(token, storeId, 500);
    const order = await createManualOrder(token, storeId, productId, variantId);
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${order.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`); // debit: commission_accrued (unknown exact amount, measured below)

    // A manual admin credit and a manual admin debit too, so every sign is exercised.
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 50, reason: "goodwill credit" });
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: -20, reason: "correction" });

    const cachedBalance = await getBalance(token);
    const trueLedgerBalance = await app.get(WalletService).computeLedgerBalance(sellerId);
    expect(cachedBalance).toBe(trueLedgerBalance);

    // Sanity: the credits/debits actually moved the needle in the right direction.
    expect(cachedBalance).toBeLessThan(1030); // 1000 + 50 - 20, minus at least some commission
    expect(cachedBalance).toBeGreaterThan(0);
  });

  it("two concurrent commission debits are both applied exactly once each (no lost update) and correctly cross the negative-float floor together, even though neither would alone (FR-6.21/FR-6.26 race fix)", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreatePublishedStore("race-fix@example.com", "race-fix-store");
    const adminToken = await createAndLoginAdmin("race-fix-admin@example.com");
    const settings = app.get(SettingsService);

    // v0.35/FR-6.30 - signupLoginAndCreatePublishedStore() already sets a
    // seller-scoped 2% override for this seller (beats the global scope
    // this line used to target, which the plan's own now-zeroed override
    // would otherwise shadow anyway).
    await topUpAndVerify(token, adminToken, 5000);

    // Measure the real per-order commission debit (K) empirically via one
    // sequential, already-legitimate order - avoids hardcoding assumptions
    // about shipping/tax on top of the product price.
    const { productId, variantId } = await addProduct(token, storeId, 2000);
    const balanceBeforeProbe = await getBalance(token);
    const probeOrder = await createManualOrder(token, storeId, productId, variantId);
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${probeOrder.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    const balanceAfterProbe = await getBalance(token);
    const perOrderCommission = round2(balanceBeforeProbe - balanceAfterProbe);
    expect(perOrderCommission).toBeGreaterThan(0);

    // Position the floor and the starting balance so that ONE more debit of
    // perOrderCommission stays at-or-above the floor, but TWO combined go
    // below it - the exact race window FR-6.26 protects.
    const floor = round2(-1.5 * perOrderCommission);
    await settings.setValue("billing.wallet_negative_float_floor", "global", null, floor, ADMIN_ID);
    const targetStartBalance = round2(floor + 1.5 * perOrderCommission); // == 0, by construction
    const currentBalance = await getBalance(token);
    const debitToTarget = round2(currentBalance - targetStartBalance);
    if (debitToTarget !== 0) {
      await request(app.getHttpServer())
        .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ amount: -debitToTarget, reason: "position for race test" });
    }
    const startBalance = await getBalance(token);
    expect(startBalance).toBe(targetStartBalance);
    expect(round2(startBalance - perOrderCommission)).toBeGreaterThanOrEqual(floor); // one alone: still ok
    expect(round2(startBalance - 2 * perOrderCommission)).toBeLessThan(floor); // both together: crosses

    // Two more orders, same price - created sequentially (order creation
    // itself is uncontested), but marked paid CONCURRENTLY via Promise.all
    // of two real HTTP requests, same technique as the Module 46 concurrent-
    // checkout oversell test.
    const orderB = await createManualOrder(token, storeId, productId, variantId);
    const orderC = await createManualOrder(token, storeId, productId, variantId);

    const [resultB, resultC] = await Promise.all([
      request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderB.body.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`),
      request(app.getHttpServer())
        .post(`/stores/${storeId}/orders/${orderC.body.id}/mark-as-paid`)
        .set("Authorization", `Bearer ${token}`),
    ]);
    // Commission accrual is unconditional - both mark-as-paid calls succeed
    // even though the combined debit crosses the negative-float floor.
    expect(resultB.status).toBe(201);
    expect(resultC.status).toBe(201);

    const finalCachedBalance = await getBalance(token);
    const finalTrueLedgerBalance = await app.get(WalletService).computeLedgerBalance(sellerId);
    // The core race-fix assertion: under real concurrency, the atomic
    // `increment` never loses an update - the cache exactly matches an
    // independent from-scratch recomputation of the ledger.
    expect(finalCachedBalance).toBe(finalTrueLedgerBalance);
    expect(finalCachedBalance).toBe(round2(targetStartBalance - 2 * perOrderCommission));

    // And the floor-pause mechanism, reading the freshly (atomically)
    // updated balance after each debit, correctly saw the combined crossing.
    const storeAfter = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(storeAfter.status).toBe("orders_paused");
  });

  it("the daily reconciliation sweep detects a deliberately-introduced drift and flags it loudly (a new admin notification, an append-only drift row) without ever silently correcting the cached balance (new FR-6.29)", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreatePublishedStore("drift-test@example.com", "drift-test-store");
    const adminToken = await createAndLoginAdmin("drift-test-admin@example.com");
    await topUpAndVerify(token, adminToken, 800);
    const { productId, variantId } = await addProduct(token, storeId, 300);
    const order = await createManualOrder(token, storeId, productId, variantId);
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${order.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);

    const trueLedgerBalance = await app.get(WalletService).computeLedgerBalance(sellerId);
    const cachedBeforeCorruption = await getBalance(token);
    expect(cachedBeforeCorruption).toBe(trueLedgerBalance); // no drift yet - sanity check

    // Deliberately corrupt the cache to simulate drift (a bug, a manual DB
    // edit, whatever) - something the reconciliation sweep must catch.
    const corruptedBalance = round2(trueLedgerBalance + 37.5);
    await superuser.walletBalance.update({ where: { sellerId }, data: { balance: corruptedBalance } });

    const notificationsBefore = await request(app.getHttpServer())
      .get("/admin/notifications")
      .set("Authorization", `Bearer ${adminToken}`);
    const driftItemBefore = notificationsBefore.body.items.find((i: { label: string }) => i.label.includes("drift"));
    expect(driftItemBefore).toBeUndefined();

    const sweepResult = await app.get(WalletReconciliationService).runSweep();
    expect(sweepResult.driftsDetected).toBeGreaterThanOrEqual(1);

    const driftRow = await superuser.walletReconciliationDrift.findFirstOrThrow({ where: { sellerId } });
    expect(Number(driftRow.cachedBalance)).toBe(corruptedBalance);
    expect(Number(driftRow.ledgerBalance)).toBe(trueLedgerBalance);
    expect(Number(driftRow.driftAmount)).toBe(round2(corruptedBalance - trueLedgerBalance));

    // Never silently corrected: the cached column still shows the corrupted
    // value after the sweep ran - a human has to review and fix it.
    const cachedAfterSweep = await getBalance(token);
    expect(cachedAfterSweep).toBe(corruptedBalance);

    const notificationsAfter = await request(app.getHttpServer())
      .get("/admin/notifications")
      .set("Authorization", `Bearer ${adminToken}`);
    const driftItemAfter = notificationsAfter.body.items.find((i: { label: string }) => i.label.includes("drift"));
    expect(driftItemAfter).toBeDefined();
    expect(driftItemAfter.count).toBeGreaterThanOrEqual(1);
  });

  it("the publish gate and the low-balance grace ladder still read correct values off the new cached balance (FR-6.21/FR-6.25 unaffected by the running-total swap)", async () => {
    const { token, sellerId } = await signup("gate-still-works@example.com");
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Gate Still Works Store", slug: "gate-still-works-store" });
    const storeId = store.body.id as string;
    const adminToken = await createAndLoginAdmin("gate-still-works-admin@example.com");

    await superuser.storePaymentInstructions.update({ where: { storeId }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: sellerId }, data: { cnicHash: `hash-${sellerId}` } });

    const settings = app.get(SettingsService);
    const minTopUp = await settings.resolve<number>("billing.wallet_min_initial_topup");

    const belowMin = await request(app.getHttpServer())
      .post(`/stores/${storeId}/publish`)
      .set("Authorization", `Bearer ${token}`);
    expect(belowMin.status).toBe(400);

    await topUpAndVerify(token, adminToken, minTopUp);
    const atMin = await request(app.getHttpServer())
      .post(`/stores/${storeId}/publish`)
      .set("Authorization", `Bearer ${token}`);
    expect(atMin.status).toBe(201);

    // Grace ladder: drain to below the warning threshold via an admin debit
    // (a real ledger write through the new atomic path), then run a sweep.
    const threshold = await settings.resolve<number>("billing.wallet_low_balance_warning_threshold");
    const balanceNow = await getBalance(token);
    const drainAmount = round2(balanceNow - threshold + 10);
    await request(app.getHttpServer())
      .post(`/admin/wallet-topups/sellers/${sellerId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: -drainAmount, reason: "drain for grace-ladder test" });

    const { WalletGraceLadderService } = await import("../../src/billing/wallet-grace-ladder.service");
    const graceLadder = app.get(WalletGraceLadderService);
    const sweep = await graceLadder.runSweep(new Date());
    expect(sweep.warned).toBe(1);

    const seller = await superuser.seller.findUniqueOrThrow({ where: { id: sellerId } });
    expect(seller.walletLowBalanceWarningSentAt).not.toBeNull();
  });
});
