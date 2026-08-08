import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { InvoicesService } from "../../src/billing/invoices.service";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS §5.6c/§14.6c - Commission & Invoicing Engine. Financial Truth
 * Invariant (§3.12) governs every test here: commission accrues only on a
 * confirmed (marked-paid) order, never a pending one.
 */
describe("Commission & Invoicing Engine (e2e) - SRS §5.6c/§14.6c", () => {
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
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    await superuser.seller.update({
      where: { userId: user.id },
      // Module 12 (FR-30.1) - checkout also requires a CNIC on file; not
      // this file's focus, so set a synthetic hash directly.
      data: { isTrusted: true, cnicHash: `test-cnic-hash-${user.id}` },
    });
    await superuser.storePaymentInstructions.update({
      where: { storeId: store.body.id },
      data: { codEnabled: true },
    });
    // Module 20 (SRS §5.6e, FR-6.21) - checkout now also requires the store
    // to be published; not this file's focus, so set it directly rather
    // than every test going through the real publish flow (top-up + verify).
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    // v0.35/FR-6.30 - every plan's commissionPercent override is now
    // seeded at 0% (UZEYN is subscription-only); this module tests the
    // commission ENGINE itself (accrual, invoicing), which still needs a
    // nonzero rate to exercise, so a seller-scoped override (highest
    // precedence, beats First Month's own now-zeroed plan-scoped
    // override) is set here rather than relying on the dormant launch
    // defaults.
    await app
      .get(SettingsService)
      .setValue("billing.commission_rate_percent", "seller", seller.id, 2, "00000000-0000-0000-0000-000000000000");
    return { token, storeId: store.body.id as string, sellerId: seller.id as string };
  }

  async function createPaidOrder(token: string, storeId: string, price: number, taxRate = 0) {
    if (taxRate > 0) {
      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/tax-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ taxRate, taxInclusive: false });
    }
    const category = await superuser.category.create({ data: { name: "Billing Test", slug: `billing-${Date.now()}-${Math.random()}` } });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Billing Product", categoryId: category.id, status: "active" });
    await superuser.product.update({ where: { id: product.body.id }, data: { moderationStatus: "approved" } });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}`, price, stockQuantity: 10 });

    const order = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        buyerEmail: "buyer@example.com",
        shippingAddress: { fullName: "Test Buyer", line1: "1 Test St", city: "Lahore", country: "PK", phone: "03001234567" },
        items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
      });

    const markPaid = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${order.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);

    return { orderId: order.body.id as string, markPaidStatus: markPaid.status };
  }

  it("FR-6.16: marking an order paid accrues commission_accrued at First Month's 2% plan-scoped rate (v0.33, signup default) on the post-discount product+shipping subtotal, excluding tax", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreateStore("commission-basic@example.com", "commission-basic-store");
    const { orderId, markPaidStatus } = await createPaidOrder(token, storeId, 1000, 10);
    expect(markPaidStatus).toBe(201);

    const entries = await superuser.ledgerEntry.findMany({ where: { sellerId, orderId } });
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("commission_accrued");
    // price 1000, tax 10% exclusive -> subtotal 1000, tax 100, total 1100.
    // Commission base = total - tax = 1000. First Month's 2% of 1000 = 20.
    expect(Number(entries[0].amount)).toBeCloseTo(20, 2);
  });

  it("Financial Truth Invariant (§3.12): a pending order accrues no commission_accrued entry", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreateStore("commission-pending@example.com", "commission-pending-store");
    const category = await superuser.category.create({ data: { name: "Pending Test", slug: "commission-pending-category" } });
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Pending Product", categoryId: category.id, status: "active" });
    await superuser.product.update({ where: { id: product.body.id }, data: { moderationStatus: "approved" } });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "PENDING-1", price: 500, stockQuantity: 5 });

    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        buyerEmail: "buyer@example.com",
        shippingAddress: { fullName: "Test Buyer", line1: "1 Test St", city: "Lahore", country: "PK", phone: "03001234567" },
        items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
      });
    // deliberately never marked paid

    const entries = await superuser.ledgerEntry.findMany({ where: { sellerId } });
    expect(entries).toHaveLength(0);
  });

  it("FR-6.17: the monthly invoice job sums a seller's commission entries for the period and is idempotent on re-run", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreateStore("invoice-gen@example.com", "invoice-gen-store");
    await createPaidOrder(token, storeId, 1000);
    await createPaidOrder(token, storeId, 2000);

    // Backdate the ledger entries into "last month" so the generator's
    // previous-calendar-month window picks them up.
    await superuser.$executeRawUnsafe(
      `UPDATE ledger_entries SET created_at = date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '15 days' WHERE seller_id = $1::uuid`,
      sellerId,
    );

    const invoicesService = app.get(InvoicesService);
    const firstRun = await invoicesService.generateMonthlyInvoices();
    expect(firstRun.generated).toBe(1);

    const invoices = await superuser.sellerInvoice.findMany({ where: { sellerId } });
    expect(invoices).toHaveLength(1);
    // First Month's 2% of 1000 + 2% of 2000 = 60
    expect(Number(invoices[0].totalAmount)).toBeCloseTo(60, 2);
    expect(invoices[0].status).toBe("pending");

    const secondRun = await invoicesService.generateMonthlyInvoices();
    expect(secondRun.generated).toBe(0); // idempotent - already invoiced this period

    const stillOneInvoice = await superuser.sellerInvoice.findMany({ where: { sellerId } });
    expect(stillOneInvoice).toHaveLength(1);
  });

  it("FR-6.18: an invoice past its due date suspends the seller's active stores; marking it paid lifts the suspension", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreateStore("invoice-overdue@example.com", "invoice-overdue-store");
    await createPaidOrder(token, storeId, 1000);
    await superuser.$executeRawUnsafe(
      `UPDATE ledger_entries SET created_at = date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '15 days' WHERE seller_id = $1::uuid`,
      sellerId,
    );

    const invoicesService = app.get(InvoicesService);
    await invoicesService.generateMonthlyInvoices();
    const invoice = await superuser.sellerInvoice.findFirstOrThrow({ where: { sellerId } });

    // Backdate its due_date into the past so the overdue sweep picks it up.
    await superuser.sellerInvoice.update({ where: { id: invoice.id }, data: { dueDate: new Date(Date.now() - 1000) } });

    const sweepResult = await invoicesService.sweepOverdueInvoicesAndSuspend();
    expect(sweepResult.suspended).toBe(1);

    const suspendedStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(suspendedStore.status).toBe("suspended");
    const overdueInvoice = await superuser.sellerInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(overdueInvoice.status).toBe("overdue");

    // Admin marks it paid - suspension lifts automatically. Calling
    // InvoicesService.markPaid() directly (same as the controller does)
    // rather than via HTTP - AdminAuthGuard's login flow isn't this test
    // file's focus, same simplification precedent as `isTrusted` above.
    const adminId = await createAdminUser(superuser);
    const paid = await invoicesService.markPaid(invoice.id, adminId);
    expect(paid.status).toBe("paid");

    const reactivatedStore = await superuser.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(reactivatedStore.status).toBe("active");
  });

  it("FR-6.20: an admin can waive a specific accrued commission without touching any other entry", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreateStore("commission-waive@example.com", "commission-waive-store");
    const first = await createPaidOrder(token, storeId, 1000);
    const second = await createPaidOrder(token, storeId, 2000);

    const invoicesService = app.get(InvoicesService);
    const adminId = await createAdminUser(superuser);
    await invoicesService.waiveCommission(sellerId, first.orderId, 20, adminId);

    const firstEntries = await superuser.ledgerEntry.findMany({ where: { sellerId, orderId: first.orderId } });
    expect(firstEntries).toHaveLength(2); // accrued + waived
    const net = firstEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    expect(net).toBeCloseTo(0, 2);

    const secondEntries = await superuser.ledgerEntry.findMany({ where: { sellerId, orderId: second.orderId } });
    expect(secondEntries).toHaveLength(1);
    expect(Number(secondEntries[0].amount)).toBeCloseTo(40, 2); // untouched (First Month's 2% of 2000)
  });

  it("tenant isolation: seller A cannot see seller B's invoices via the API; RLS denies cross-tenant ledger access at the database level", async () => {
    const a = await signupLoginAndCreateStore("invoice-tenant-a@example.com", "invoice-tenant-a-store");
    const b = await signupLoginAndCreateStore("invoice-tenant-b@example.com", "invoice-tenant-b-store");
    await createPaidOrder(a.token, a.storeId, 1000);
    await superuser.$executeRawUnsafe(`UPDATE ledger_entries SET created_at = date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '15 days' WHERE seller_id = $1::uuid`, a.sellerId);

    const invoicesService = app.get(InvoicesService);
    await invoicesService.generateMonthlyInvoices();

    const bInvoices = await request(app.getHttpServer())
      .get("/sellers/me/invoices")
      .set("Authorization", `Bearer ${b.token}`);
    expect(bInvoices.status).toBe(200);
    expect(bInvoices.body).toEqual([]);

    const aInvoices = await request(app.getHttpServer())
      .get("/sellers/me/invoices")
      .set("Authorization", `Bearer ${a.token}`);
    expect(aInvoices.status).toBe(200);
    expect(aInvoices.body).toHaveLength(1);

    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const seenByB = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${b.sellerId}'`);
      return tx.ledgerEntry.findMany();
    });
    expect(seenByB).toEqual([]);
    await runtime.$disconnect();
  });

  async function createAdminUser(prisma: PrismaClient): Promise<string> {
    const user = await prisma.user.create({
      data: { email: `admin-${Date.now()}@example.com`, passwordHash: "x", roleFlags: ["admin"] },
    });
    const admin = await prisma.adminUser.create({
      data: { userId: user.id, role: "super_admin", mfaEnabled: false },
    });
    return admin.id;
  }
});
