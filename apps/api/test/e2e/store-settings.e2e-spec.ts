import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * SRS FR-2.10/FR-2.11/FR-19.3, §14.2 (partial) - seller-configured shipping
 * settings, tax settings, and discount codes. The actual checkout-time
 * application of these (FR-5.5/FR-5.6, tax computation) is Module 9's job
 * once checkout exists; what's tested here is the settings CRUD itself and
 * its tenant isolation.
 */
describe("Shipping, Tax & Discounts (e2e) - SRS FR-2.10/FR-2.11/FR-19.3, §14.2", () => {
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

  describe("Shipping settings (FR-2.10)", () => {
    it("is auto-created with v1.0 defaults the moment a store is created, and can be updated", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("ship-defaults@example.com", "ship-defaults-store");

      const get = await request(app.getHttpServer())
        .get(`/stores/${storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${token}`);
      expect(get.status).toBe(200);
      expect(Number(get.body.flatRate)).toBe(0);
      expect(get.body.freeShippingThreshold).toBeNull();

      const update = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ flatRate: 250, freeShippingThreshold: 5000 });
      expect(update.status).toBe(200);
      expect(Number(update.body.flatRate)).toBe(250);
      expect(Number(update.body.freeShippingThreshold)).toBe(5000);

      const clear = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ freeShippingThreshold: null });
      expect(clear.status).toBe(200);
      expect(clear.body.freeShippingThreshold).toBeNull();
    });

    it("seller A cannot read or update seller B's shipping settings via the API (tenant isolation)", async () => {
      const a = await signupLoginAndCreateStore("ship-tenant-a@example.com", "ship-tenant-a-store");
      const b = await signupLoginAndCreateStore("ship-tenant-b@example.com", "ship-tenant-b-store");

      const crossRead = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossRead.status).toBe(404);

      const crossUpdate = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}/shipping-settings`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ flatRate: 999 });
      expect(crossUpdate.status).toBe(404);

      const unchanged = await superuser.storeShippingSettings.findUniqueOrThrow({ where: { storeId: a.storeId } });
      expect(Number(unchanged.flatRate)).toBe(0);
    });
  });

  describe("Tax settings (FR-19.3)", () => {
    it("is auto-created with v1.0 defaults, can be updated, and rejects an out-of-range rate", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("tax-defaults@example.com", "tax-defaults-store");

      const get = await request(app.getHttpServer())
        .get(`/stores/${storeId}/tax-settings`)
        .set("Authorization", `Bearer ${token}`);
      expect(get.status).toBe(200);
      expect(Number(get.body.taxRate)).toBe(0);
      expect(get.body.taxInclusive).toBe(true);
      expect(get.body.taxLabel).toBe("Tax");

      const update = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/tax-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ taxRate: 17, taxInclusive: false, taxLabel: "GST" });
      expect(update.status).toBe(200);
      expect(Number(update.body.taxRate)).toBe(17);
      expect(update.body.taxInclusive).toBe(false);
      expect(update.body.taxLabel).toBe("GST");

      const outOfRange = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/tax-settings`)
        .set("Authorization", `Bearer ${token}`)
        .send({ taxRate: 105 });
      expect(outOfRange.status).toBe(400);
    });

    it("seller A cannot read or update seller B's tax settings via the API (tenant isolation)", async () => {
      const a = await signupLoginAndCreateStore("tax-tenant-a@example.com", "tax-tenant-a-store");
      const b = await signupLoginAndCreateStore("tax-tenant-b@example.com", "tax-tenant-b-store");

      const crossRead = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/tax-settings`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossRead.status).toBe(404);

      const crossUpdate = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}/tax-settings`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ taxRate: 50 });
      expect(crossUpdate.status).toBe(404);

      const unchanged = await superuser.storeTaxSettings.findUniqueOrThrow({ where: { storeId: a.storeId } });
      expect(Number(unchanged.taxRate)).toBe(0);
    });
  });

  describe("Discount codes (FR-2.11)", () => {
    it("creates, lists, updates, and deletes a discount code", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("discount-crud@example.com", "discount-crud-store");

      const create = await request(app.getHttpServer())
        .post(`/stores/${storeId}/discount-codes`)
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "SUMMER10", type: "percentage", value: 10, usageLimit: 100 });
      expect(create.status).toBe(201);
      const discountCodeId = create.body.id;
      expect(create.body.usageCount).toBe(0);
      expect(create.body.isActive).toBe(true);

      const list = await request(app.getHttpServer())
        .get(`/stores/${storeId}/discount-codes`)
        .set("Authorization", `Bearer ${token}`);
      expect(list.body).toHaveLength(1);

      const update = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/discount-codes/${discountCodeId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false });
      expect(update.status).toBe(200);
      expect(update.body.isActive).toBe(false);

      const remove = await request(app.getHttpServer())
        .delete(`/stores/${storeId}/discount-codes/${discountCodeId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(remove.status).toBe(200);

      const listAfter = await request(app.getHttpServer())
        .get(`/stores/${storeId}/discount-codes`)
        .set("Authorization", `Bearer ${token}`);
      expect(listAfter.body).toHaveLength(0);
    });

    it("rejects a duplicate code within the same store, but the same code is fine in a different store", async () => {
      const a = await signupLoginAndCreateStore("discount-code-a@example.com", "discount-code-a-store");
      const b = await signupLoginAndCreateStore("discount-code-b@example.com", "discount-code-b-store");

      const first = await request(app.getHttpServer())
        .post(`/stores/${a.storeId}/discount-codes`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ code: "SAVE20", type: "fixed_amount", value: 20 });
      expect(first.status).toBe(201);

      const dupe = await request(app.getHttpServer())
        .post(`/stores/${a.storeId}/discount-codes`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ code: "SAVE20", type: "percentage", value: 5 });
      expect(dupe.status).toBe(409);

      const otherStoreSameCode = await request(app.getHttpServer())
        .post(`/stores/${b.storeId}/discount-codes`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ code: "SAVE20", type: "fixed_amount", value: 20 });
      expect(otherStoreSameCode.status).toBe(201);
    });

    it("rejects a percentage discount value over 100, on both create and update", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("discount-pct-cap@example.com", "discount-pct-cap-store");

      const create = await request(app.getHttpServer())
        .post(`/stores/${storeId}/discount-codes`)
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "TOOMUCH", type: "percentage", value: 150 });
      expect(create.status).toBe(400);

      const valid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/discount-codes`)
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "FIFTY", type: "percentage", value: 50 });
      expect(valid.status).toBe(201);

      const update = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/discount-codes/${valid.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ value: 150 });
      expect(update.status).toBe(400);
    });

    it("a fixed_amount discount is not subject to the percentage cap", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("discount-fixed@example.com", "discount-fixed-store");

      const create = await request(app.getHttpServer())
        .post(`/stores/${storeId}/discount-codes`)
        .set("Authorization", `Bearer ${token}`)
        .send({ code: "BIGFIXED", type: "fixed_amount", value: 5000 });
      expect(create.status).toBe(201);
    });

    it("seller A cannot read, update, or delete seller B's discount code via the API (tenant isolation)", async () => {
      const a = await signupLoginAndCreateStore("discount-tenant-a@example.com", "discount-tenant-a-store");
      const b = await signupLoginAndCreateStore("discount-tenant-b@example.com", "discount-tenant-b-store");
      const code = await request(app.getHttpServer())
        .post(`/stores/${a.storeId}/discount-codes`)
        .set("Authorization", `Bearer ${a.token}`)
        .send({ code: "AONLY", type: "percentage", value: 10 });

      const crossRead = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/discount-codes/${code.body.id}`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossRead.status).toBe(404);

      const crossUpdate = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}/discount-codes/${code.body.id}`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ isActive: false });
      expect(crossUpdate.status).toBe(404);

      const crossDelete = await request(app.getHttpServer())
        .delete(`/stores/${a.storeId}/discount-codes/${code.body.id}`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossDelete.status).toBe(404);

      const unchanged = await superuser.discountCode.findUniqueOrThrow({ where: { id: code.body.id } });
      expect(unchanged.isActive).toBe(true);
    });

    it("RLS denies cross-tenant access to discount codes at the database level, independent of the app layer", async () => {
      const sellerA = await superuser.seller.create({
        data: {
          businessName: "DB-level A",
          user: { create: { email: "discount-db-a@example.com", roleFlags: ["seller"] } },
        },
      });
      const sellerB = await superuser.seller.create({
        data: {
          businessName: "DB-level B",
          user: { create: { email: "discount-db-b@example.com", roleFlags: ["seller"] } },
        },
      });
      const storeA = await superuser.store.create({
        data: { sellerId: sellerA.id, name: "DB Store A", slug: "discount-db-store-a" },
      });
      await superuser.store.create({ data: { sellerId: sellerB.id, name: "DB Store B", slug: "discount-db-store-b" } });
      await superuser.discountCode.create({
        data: { storeId: storeA.id, code: "DBONLY", type: "percentage", value: 10 },
      });

      const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
      const seenByB = await runtime.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerB.id}'`);
        return tx.discountCode.findMany();
      });
      expect(seenByB).toEqual([]);

      const seenByA = await runtime.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerA.id}'`);
        return tx.discountCode.findMany();
      });
      expect(seenByA).toHaveLength(1);

      const noContext = await runtime.$transaction(async (tx) => tx.discountCode.findMany());
      expect(noContext).toEqual([]); // fail-closed

      await runtime.$disconnect();
    });
  });

  describe("Payment instructions (FR-6.14, Module 11 prerequisite fix)", () => {
    it("is auto-created with v1.0 defaults the moment a store is created, and can be updated", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("pay-defaults@example.com", "pay-defaults-store");

      const get = await request(app.getHttpServer())
        .get(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`);
      expect(get.status).toBe(200);
      expect(get.body.bankAccountNumber).toBeNull();
      expect(get.body.jazzcashNumber).toBeNull();
      expect(get.body.easypaisaNumber).toBeNull();
      expect(get.body.codEnabled).toBe(false);

      const update = await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          bankAccountTitle: "Checkpoint Store",
          bankAccountNumber: "PK00BANK0000000000000000",
          bankName: "Test Bank",
          jazzcashNumber: "03001234567",
          codEnabled: true,
        });
      expect(update.status).toBe(200);
      expect(update.body.bankAccountNumber).toBe("PK00BANK0000000000000000");
      expect(update.body.jazzcashNumber).toBe("03001234567");
      expect(update.body.codEnabled).toBe(true);
    });

    it("seller A cannot read or update seller B's payment instructions via the API (tenant isolation)", async () => {
      const a = await signupLoginAndCreateStore("pay-tenant-a@example.com", "pay-tenant-a-store");
      const b = await signupLoginAndCreateStore("pay-tenant-b@example.com", "pay-tenant-b-store");

      const crossRead = await request(app.getHttpServer())
        .get(`/stores/${a.storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${b.token}`);
      expect(crossRead.status).toBe(404);

      const crossUpdate = await request(app.getHttpServer())
        .patch(`/stores/${a.storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${b.token}`)
        .send({ codEnabled: true });
      expect(crossUpdate.status).toBe(404);
    });

    it("checkout is rejected until at least one payment method is configured (FR-6.14 store-readiness gate)", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("pay-gate@example.com", "pay-gate-store");

      const category = await superuser.category.create({ data: { name: "Gate Test", slug: "pay-gate-category" } });
      const product = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Gate Product", categoryId: category.id, status: "active" });
      await superuser.product.update({ where: { id: product.body.id }, data: { moderationStatus: "approved" } });
      const variant = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sku: "GATE-1", price: 100, stockQuantity: 10 });

      const manualOrderWithoutPayment = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          buyerEmail: "buyer@example.com",
          shippingAddress: {
            fullName: "Test Buyer",
            line1: "1 Test St",
            city: "Lahore",
            country: "PK",
            phone: "03001234567",
          },
          items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
        });
      expect(manualOrderWithoutPayment.status).toBe(400);

      await request(app.getHttpServer())
        .patch(`/stores/${storeId}/payment-instructions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ codEnabled: true });

      const manualOrderWithPayment = await request(app.getHttpServer())
        .post(`/stores/${storeId}/orders`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          buyerEmail: "buyer@example.com",
          shippingAddress: {
            fullName: "Test Buyer",
            line1: "1 Test St",
            city: "Lahore",
            country: "PK",
            phone: "03001234567",
          },
          items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }],
        });
      expect(manualOrderWithPayment.status).toBe(201);
    });
  });
});
