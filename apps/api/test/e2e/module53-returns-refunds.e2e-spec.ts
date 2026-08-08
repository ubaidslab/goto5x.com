import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { ReturnsService } from "../../src/returns/returns.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { UnitEconomicsService } from "../../src/guardrails/unit-economics.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const shippingAddress = { fullName: "Buyer", line1: "House 1", city: "Lahore", country: "PK", phone: "03001234567" };

/**
 * Module 53 (SRS §5.60/FR-60.1-60.6) - Returns & Refunds Workflow, the
 * Financial Truth Invariant's reversal path. Founder's explicit ask: tests
 * proving a refunded order no longer counts as revenue, and that the
 * commission reversal lands in the ledger.
 */
describe("Returns & Refunds Workflow (e2e) - SRS §5.60/§14.59 (Module 53)", () => {
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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    // v0.35/FR-6.30 - every plan's commissionPercent override is now
    // seeded at 0% (UZEYN is subscription-only); this module's actual
    // subject is the commission-REVERSAL mechanism on refund, which still
    // needs a nonzero accrued amount to reverse to prove anything, so a
    // seller-scoped override (highest precedence, beats the plan's own
    // now-zeroed override) is set for every seller this helper creates.
    await app
      .get(SettingsService)
      .setValue("billing.commission_rate_percent", "seller", storeRow.sellerId, 2, "00000000-0000-0000-0000-000000000000");
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId, hostname: `${slug}.uzeyn.com` };
  }

  async function createSelfProduct(token: string, storeId: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  /** Places and pays for one order (via storefront checkout + mark-as-paid), returning its detail incl. statusLookupToken. */
  async function placeAndPayOrder(token: string, storeId: string, hostname: string, price: number, buyerEmail = "buyer@example.com") {
    const { productId, variantId } = await createSelfProduct(token, storeId, price);
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail, items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${checkout.body.id}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
    const detail = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders/${checkout.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    return {
      orderId: checkout.body.id as string,
      token: detail.body.statusLookupToken as string,
      totalAmount: Number(detail.body.totalAmount),
    };
  }

  async function createAdminUser(): Promise<string> {
    const user = await superuser.user.create({
      data: { email: `admin-${Date.now()}-${Math.random()}@example.com`, passwordHash: "x", roleFlags: ["admin"] },
    });
    const admin = await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    return admin.id;
  }

  describe("Buyer-initiated return request (FR-60.2)", () => {
    it("rejects a return request for a still-pending (never paid) order", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("return-pending@example.com", "return-pending-store");
      const { productId, variantId } = await createSelfProduct(token, storeId, 500);
      const cart = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
      const checkout = await request(app.getHttpServer())
        .post("/storefront/checkout")
        .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
      const detail = await request(app.getHttpServer())
        .get(`/stores/${storeId}/orders/${checkout.body.id}`)
        .set("Authorization", `Bearer ${token}`);

      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${detail.body.statusLookupToken}/returns`)
        .send({ reason: "Changed my mind" });
      expect(submit.status).toBe(400);
    });

    it("accepts a return request for a confirmed (paid) order, and rejects a second concurrent one", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("return-ok@example.com", "return-ok-store");
      const order = await placeAndPayOrder(token, storeId, hostname, 500);

      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "Item arrived damaged" });
      expect(submit.status).toBe(201);
      expect(submit.body.status).toBe("requested");

      const again = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "Also want to return" });
      expect(again.status).toBe(400);
    });
  });

  describe("Seller approve/reject (FR-60.3)", () => {
    it("requires a reason to reject", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("return-reject@example.com", "return-reject-store");
      const order = await placeAndPayOrder(token, storeId, hostname, 500);
      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "Wrong size" });

      const noReason = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/returns/${submit.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "rejected" });
      expect(noReason.status).toBe(400);

      const withReason = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/returns/${submit.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "rejected", sellerNote: "Outside the return window" });
      expect(withReason.status).toBe(200);
      expect(withReason.body.status).toBe("rejected");
    });

    it("approves a return request, moving it to 'approved' (no money touched yet)", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("return-approve@example.com", "return-approve-store");
      const order = await placeAndPayOrder(token, storeId, hostname, 500);
      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "Wrong color" });

      const approve = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/returns/${submit.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });
      expect(approve.status).toBe(200);
      expect(approve.body.status).toBe("approved");

      const unchangedOrder = await superuser.order.findUniqueOrThrow({ where: { id: order.orderId } });
      expect(unchangedOrder.status).toBe("confirmed");
      const ledgerEntries = await superuser.ledgerEntry.findMany({ where: { orderId: order.orderId } });
      expect(ledgerEntries.every((e) => e.type !== "refund_adjustment")).toBe(true);
    });

    it("rejects completing a return that hasn't been approved yet", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("return-early-complete@example.com", "return-early-complete-store");
      const order = await placeAndPayOrder(token, storeId, hostname, 500);
      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "Wrong item" });

      const complete = await request(app.getHttpServer())
        .post(`/stores/${storeId}/returns/${submit.body.id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ refundAmount: order.totalAmount });
      expect(complete.status).toBe(400);
    });
  });

  describe("Full refund - the Financial Truth reversal (FR-60.1/60.4)", () => {
    it("reverses commission via a refund_adjustment ledger entry, credits the seller's wallet, decrements customer stats, and moves Order.status to 'refunded'", async () => {
      const { token, storeId, hostname, sellerId } = await signupLoginAndCreateStore("refund-full@example.com", "refund-full-store");
      const order = await placeAndPayOrder(token, storeId, hostname, 1000, "fullrefund@example.com");

      const walletBefore = await superuser.walletBalance.findUniqueOrThrow({ where: { sellerId } });
      const accrued = await superuser.ledgerEntry.findFirstOrThrow({ where: { orderId: order.orderId, type: "commission_accrued" } });

      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "Defective" });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/returns/${submit.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });
      const complete = await request(app.getHttpServer())
        .post(`/stores/${storeId}/returns/${submit.body.id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ refundAmount: order.totalAmount });
      expect(complete.status).toBe(201);
      expect(complete.body.status).toBe("refunded");

      // Ledger reversal, sized to the full accrued commission (100% refund).
      const refundEntry = await superuser.ledgerEntry.findFirstOrThrow({ where: { orderId: order.orderId, type: "refund_adjustment" } });
      expect(Number(refundEntry.amount)).toBeCloseTo(-Number(accrued.amount), 2);

      // Wallet credited back by the exact reversed amount.
      const walletAfter = await superuser.walletBalance.findUniqueOrThrow({ where: { sellerId } });
      expect(Number(walletAfter.balance) - Number(walletBefore.balance)).toBeCloseTo(Number(accrued.amount), 2);

      // Customer stats fully reversed (a full refund undoes the whole order).
      const customer = await superuser.customer.findFirstOrThrow({ where: { storeId, email: "fullrefund@example.com" } });
      expect(customer.ordersCount).toBe(0);
      expect(Number(customer.totalSpent)).toBeCloseTo(0, 2);

      // A refunded Payment row records the reversal without erasing the original.
      const payments = await superuser.payment.findMany({ where: { orderId: order.orderId }, orderBy: { createdAt: "asc" } });
      expect(payments.map((p) => p.status)).toEqual(["succeeded", "refunded"]);

      // Order.status is the terminal 'refunded' state.
      const finalOrder = await superuser.order.findUniqueOrThrow({ where: { id: order.orderId } });
      expect(finalOrder.status).toBe("refunded");
    });

    it("a refunded order stops counting as revenue: P&L rejects it (not confirmed+) and platform GMV/commission drop to reflect the reversal", async () => {
      const { token, storeId, hostname, sellerId } = await signupLoginAndCreateStore("refund-pnl@example.com", "refund-pnl-store");
      const order = await placeAndPayOrder(token, storeId, hostname, 1000, "pnlrefund@example.com");

      // AdminAuthGuard's own login flow isn't this test's focus - same
      // simplification precedent as billing.e2e-spec.ts's createAdminUser()
      // helper: call UnitEconomicsService directly, same code path the
      // /admin/analytics controller itself calls.
      const unitEconomics = app.get(UnitEconomicsService);
      const beforeAnalytics = await unitEconomics.computeRealTimeAnalytics();
      const gmvBefore = beforeAnalytics.gmv;
      const commissionBefore = beforeAnalytics.commissionEarned;

      const pnlBefore = await request(app.getHttpServer())
        .get(`/stores/${storeId}/pnl/orders/${order.orderId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(pnlBefore.status).toBe(200);

      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "Not as described" });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/returns/${submit.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });
      await request(app.getHttpServer())
        .post(`/stores/${storeId}/returns/${submit.body.id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ refundAmount: order.totalAmount });

      // Financial Truth Invariant: PnLService.getOrderProfit() rejects an
      // order outside CONFIRMED_OR_BEYOND, same as it would a pending one.
      const pnlAfter = await request(app.getHttpServer())
        .get(`/stores/${storeId}/pnl/orders/${order.orderId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(pnlAfter.status).toBe(400);

      const afterAnalytics = await unitEconomics.computeRealTimeAnalytics();
      expect(afterAnalytics.gmv).toBeCloseTo(gmvBefore - order.totalAmount, 2);
      expect(afterAnalytics.commissionEarned).toBeLessThan(commissionBefore);
      void sellerId;
    });
  });

  describe("Partial refund (FR-60.4)", () => {
    it("a partial refund lands the order in 'partially_refunded', reverses commission proportionally, and only decrements totalSpent (not ordersCount)", async () => {
      const { token, storeId, hostname, sellerId } = await signupLoginAndCreateStore("refund-partial@example.com", "refund-partial-store");
      const order = await placeAndPayOrder(token, storeId, hostname, 1000, "partialrefund@example.com");
      const accrued = await superuser.ledgerEntry.findFirstOrThrow({ where: { orderId: order.orderId, type: "commission_accrued" } });

      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "One item missing" });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/returns/${submit.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });
      const complete = await request(app.getHttpServer())
        .post(`/stores/${storeId}/returns/${submit.body.id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ refundAmount: 400 }); // 40% of a 1000 order
      expect(complete.status).toBe(201);
      expect(complete.body.status).toBe("partially_refunded");

      const refundEntry = await superuser.ledgerEntry.findFirstOrThrow({ where: { orderId: order.orderId, type: "refund_adjustment" } });
      expect(Number(refundEntry.amount)).toBeCloseTo(-Number(accrued.amount) * 0.4, 2);

      const customer = await superuser.customer.findFirstOrThrow({ where: { storeId, email: "partialrefund@example.com" } });
      expect(customer.ordersCount).toBe(1); // the purchase itself still happened
      expect(Number(customer.totalSpent)).toBeCloseTo(600, 2); // 1000 - 400

      const finalOrder = await superuser.order.findUniqueOrThrow({ where: { id: order.orderId } });
      expect(finalOrder.status).toBe("partially_refunded");
      void sellerId;
    });

    it("rejects a refund amount exceeding what's still refundable, and a second partial refund can bring the order to fully 'refunded'", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("refund-exceed@example.com", "refund-exceed-store");
      const order = await placeAndPayOrder(token, storeId, hostname, 1000);

      const submit1 = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "Partial issue" });
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/returns/${submit1.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });
      const tooMuch = await request(app.getHttpServer())
        .post(`/stores/${storeId}/returns/${submit1.body.id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ refundAmount: 1500 });
      expect(tooMuch.status).toBe(400);

      const first = await request(app.getHttpServer())
        .post(`/stores/${storeId}/returns/${submit1.body.id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ refundAmount: 600 });
      expect(first.status).toBe(201);
      expect(first.body.status).toBe("partially_refunded");

      // A second return request, completing the remaining 400.
      const submit2 = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "The rest too" });
      expect(submit2.status).toBe(201);
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/returns/${submit2.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "approved" });
      const overRemaining = await request(app.getHttpServer())
        .post(`/stores/${storeId}/returns/${submit2.body.id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ refundAmount: 401 });
      expect(overRemaining.status).toBe(400);

      const second = await request(app.getHttpServer())
        .post(`/stores/${storeId}/returns/${submit2.body.id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ refundAmount: 400 });
      expect(second.status).toBe(201);
      expect(second.body.status).toBe("refunded");

      const finalOrder = await superuser.order.findUniqueOrThrow({ where: { id: order.orderId } });
      expect(finalOrder.status).toBe("refunded");
    });
  });

  describe("Admin override (FR-60.5)", () => {
    it("an admin can approve and complete a return the seller never acted on, audited with adminOverride=true", async () => {
      const { token, storeId, hostname } = await signupLoginAndCreateStore("refund-admin@example.com", "refund-admin-store");
      const order = await placeAndPayOrder(token, storeId, hostname, 800);
      const submit = await request(app.getHttpServer())
        .post(`/storefront/order-status/${order.token}/returns`)
        .send({ reason: "Escalated to admin" });

      const adminId = await createAdminUser();
      const returnsService = app.get(ReturnsService);
      const approved = await returnsService.adminDecide(adminId, submit.body.id, { status: "approved" });
      expect(approved.status).toBe("approved");
      expect(approved.adminOverride).toBe(true);

      const completed = await returnsService.adminComplete(adminId, submit.body.id, { refundAmount: order.totalAmount });
      expect(completed.status).toBe("refunded");

      const returnRow = await superuser.returnRequest.findUniqueOrThrow({ where: { id: submit.body.id } });
      expect(returnRow.status).toBe("completed");
      expect(returnRow.adminOverride).toBe(true);
      expect(returnRow.resolvedByType).toBe("admin");

      // FR-60.5's own text: "audit-logged with before/after values", same
      // discipline as every other admin override in this SRS.
      const auditEntries = await superuser.adminAuditLog.findMany({
        where: { adminUserId: adminId, targetId: submit.body.id },
        orderBy: { createdAt: "asc" },
      });
      expect(auditEntries.map((e) => e.action)).toEqual(["returns.admin_decide", "returns.admin_complete"]);
      expect((auditEntries[0].beforeValue as { status: string }).status).toBe("requested");
      expect((auditEntries[0].afterValue as { status: string }).status).toBe("approved");
      expect((auditEntries[1].afterValue as { status: string }).status).toBe("completed");
      void token;
    });
  });
});
