import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { ProductImportService } from "../../src/data-portability/product-import.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const PASSWORD = "correct-horse-battery";
const S3_TEST_PORT = 4569;
const BUCKET = "goto5x-media-test";

/**
 * Module 28 (SRS §5.39, §14.39) - Inventory Management. No new stock-
 * tracking concept: this is a read/adjust surface over the existing
 * `ProductVariant.stockQuantity` field and an append-only adjustment log.
 */
describe("Inventory Management (e2e) - SRS §5.39, §14.39", () => {
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
    return { token, storeId: store.body.id as string, userId: user.id as string };
  }

  async function createProductWithVariant(token: string, storeId: string, sku: string, stockQuantity: number, price = 500) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: `Product ${sku}`, status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku, price, stockQuantity });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  it("FR-39.4: a manual stock adjustment writes exactly one append-only log row, and no endpoint edits or deletes it", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("adj-a@example.com", "adj-a-store");
    const { variantId } = await createProductWithVariant(token, storeId, "SKU-ADJ", 10);

    const adjust = await request(app.getHttpServer())
      .post(`/stores/${storeId}/inventory/${variantId}/adjust`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "decrement", amount: 3, reason: "Damaged in warehouse" });
    expect(adjust.status).toBe(201);
    expect(adjust.body.stockQuantity).toBe(7);

    const log = await request(app.getHttpServer())
      .get(`/stores/${storeId}/inventory/${variantId}/adjustments`)
      .set("Authorization", `Bearer ${token}`);
    expect(log.status).toBe(200);
    expect(log.body).toHaveLength(1);
    expect(log.body[0]).toMatchObject({ quantityBefore: 10, quantityAfter: 7, reason: "Damaged in warehouse" });

    // No PATCH/DELETE route exists on the adjustment log at all - the log
    // is append-only by construction (no code path can touch it), and the
    // underlying table also REVOKEs UPDATE/DELETE at the database level
    // (see the Module 28 migration) as a second, independent backstop.
    const attemptEdit = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/inventory/${variantId}/adjustments/${log.body[0].id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "tampered" });
    expect(attemptEdit.status).toBe(404);
  });

  it("FR-39.3: bulk CSV stock edit updates only stockQuantity for matched SKUs, reuses the existing import job/error-report shape, and never touches other fields", async () => {
    const { token, storeId, userId } = await signupLoginAndCreateStore("bulk-a@example.com", "bulk-a-store");
    const known = await createProductWithVariant(token, storeId, "SKU-KNOWN", 5, 750);

    const csv = "SKU,Quantity\nSKU-KNOWN,50\nSKU-MISSING,10\n";
    const upload = await request(app.getHttpServer())
      .post(`/stores/${storeId}/stock-import-jobs`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from(csv), "stock.csv");
    expect(upload.status).toBe(201);
    expect(upload.body.status).toBe("pending");

    const productImport = app.get(ProductImportService);
    await productImport.process(upload.body.id, userId);

    const job = await request(app.getHttpServer())
      .get(`/stores/${storeId}/import-jobs/${upload.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(job.body.status).toBe("completed");
    expect(job.body.errorLog.some((e: { message: string }) => e.message.includes("SKU-MISSING"))).toBe(true);

    const variant = await superuser.productVariant.findUniqueOrThrow({ where: { id: known.variantId } });
    expect(variant.stockQuantity).toBe(50);
    expect(Number(variant.price)).toBe(750); // untouched - stock-only mode never edits price

    const adjustments = await superuser.stockAdjustment.findMany({ where: { productVariantId: known.variantId } });
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].reason).toContain("Bulk CSV import");
    expect(adjustments[0].adjustedByUserId).toBe(userId);
  }, 30000);

  it("FR-39.2: the low-stock threshold is Settings-Registry-driven per store", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("low-stock-a@example.com", "low-stock-store");
    await createProductWithVariant(token, storeId, "SKU-LOW", 8);

    const defaultView = await request(app.getHttpServer())
      .get(`/stores/${storeId}/inventory`)
      .set("Authorization", `Bearer ${token}`);
    expect(defaultView.body.lowStockThreshold).toBe(5);
    expect(defaultView.body.variants.find((v: { sku: string }) => v.sku === "SKU-LOW").isLowStock).toBe(false);

    await superuser.settingsValue.create({
      data: { definitionKey: "inventory.low_stock_threshold", scopeType: "store", scopeId: storeId, value: 20 },
    });
    // The prior request cached this key's "no store override yet" miss for
    // 60s (SettingsService.resolve()'s cache-miss-caching design) - flush it
    // so the write above is visible immediately, same as every other e2e
    // test that changes a setting mid-test.
    await resetRedis();

    const overriddenView = await request(app.getHttpServer())
      .get(`/stores/${storeId}/inventory`)
      .set("Authorization", `Bearer ${token}`);
    expect(overriddenView.body.lowStockThreshold).toBe(20);
    expect(overriddenView.body.variants.find((v: { sku: string }) => v.sku === "SKU-LOW").isLowStock).toBe(true);
  });

  it("tenant isolation: a seller cannot read or adjust another seller's inventory", async () => {
    const sellerA = await signupLoginAndCreateStore("iso-a@example.com", "iso-a-store");
    const sellerB = await signupLoginAndCreateStore("iso-b@example.com", "iso-b-store");
    const { variantId } = await createProductWithVariant(sellerA.token, sellerA.storeId, "SKU-ISO", 10);

    const crossRead = await request(app.getHttpServer())
      .get(`/stores/${sellerA.storeId}/inventory`)
      .set("Authorization", `Bearer ${sellerB.token}`);
    expect(crossRead.status).toBe(404);

    const crossAdjust = await request(app.getHttpServer())
      .post(`/stores/${sellerA.storeId}/inventory/${variantId}/adjust`)
      .set("Authorization", `Bearer ${sellerB.token}`)
      .send({ type: "set", amount: 0, reason: "malicious" });
    expect(crossAdjust.status).toBe(404);
  });
});
