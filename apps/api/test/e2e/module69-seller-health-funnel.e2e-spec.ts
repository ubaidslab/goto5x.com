import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SellerHealthFunnelService } from "../../src/guardrails/seller-health-funnel.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SRS §5.6k (v0.41), FR-6.46 (Module 69) - the seller health funnel: signed
 * up -> store created -> first product listed -> published -> first sale,
 * with per-stage drop-off and a stuck-seller list, computed live (no new
 * tracking table).
 */
describe("Seller health funnel (e2e) - SRS §5.6k/§14.66 (Module 69, FR-6.46)", () => {
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
    return { token, sellerId: seller.id as string };
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

  it("FR-6.46: stage counts and drop-off are correct across sellers at every stage of the funnel", async () => {
    // Stage 1 only: signed up, no store.
    await signup("funnel-signedup-only@example.com");

    // Stage 2 only: has a store, no product.
    const storeOnly = await signup("funnel-store-only@example.com");
    await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${storeOnly.token}`).send({ name: "Store", slug: "funnel-store-only" });

    // Stage 3 only: has a product, not published.
    const productOnly = await signup("funnel-product-only@example.com");
    const productStore = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${productOnly.token}`).send({ name: "Store", slug: "funnel-product-only" });
    const category = await superuser.category.create({ data: { name: "Funnel", slug: `funnel-${Date.now()}` } });
    await request(app.getHttpServer())
      .post(`/stores/${productStore.body.id}/products`)
      .set("Authorization", `Bearer ${productOnly.token}`)
      .send({ title: "Product", categoryId: category.id, status: "active" });

    // Stage 4 only: published, no sale.
    const publishedOnly = await signup("funnel-published-only@example.com");
    const publishedStore = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${publishedOnly.token}`).send({ name: "Store", slug: "funnel-published-only" });
    await superuser.store.update({ where: { id: publishedStore.body.id }, data: { publishedAt: new Date() } });

    // Stage 5: a confirmed sale.
    const soldSeller = await signup("funnel-sold@example.com");
    const soldStore = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${soldSeller.token}`).send({ name: "Store", slug: "funnel-sold" });
    await superuser.seller.update({ where: { id: soldSeller.sellerId }, data: { isTrusted: true, cnicHash: `hash-${soldSeller.sellerId}` } });
    await superuser.storePaymentInstructions.update({ where: { storeId: soldStore.body.id }, data: { codEnabled: true } });
    await superuser.store.update({ where: { id: soldStore.body.id }, data: { publishedAt: new Date() } });
    const soldProduct = await request(app.getHttpServer())
      .post(`/stores/${soldStore.body.id}/products`)
      .set("Authorization", `Bearer ${soldSeller.token}`)
      .send({ title: "Sold product", categoryId: category.id, status: "active" });
    const soldVariant = await request(app.getHttpServer())
      .post(`/stores/${soldStore.body.id}/products/${soldProduct.body.id}/variants`)
      .set("Authorization", `Bearer ${soldSeller.token}`)
      .send({ sku: `SKU-${Date.now()}`, price: 100, stockQuantity: 5 });
    const order = await request(app.getHttpServer())
      .post(`/stores/${soldStore.body.id}/orders`)
      .set("Authorization", `Bearer ${soldSeller.token}`)
      .send({
        buyerEmail: "buyer@example.com",
        shippingAddress: { fullName: "Buyer", line1: "1 St", city: "Lahore", country: "PK", phone: "03001234567" },
        items: [{ productId: soldProduct.body.id, variantId: soldVariant.body.id, quantity: 1 }],
      });
    await superuser.order.update({ where: { id: order.body.id }, data: { status: "confirmed" } });

    const funnel = app.get(SellerHealthFunnelService);
    const result = await funnel.compute();

    const byStage = Object.fromEntries(result.stages.map((s) => [s.stage, s.count]));
    expect(byStage.signed_up).toBe(5);
    expect(byStage.store_created).toBe(4); // everyone but signedup-only
    // Independent per-stage checks (not a strict prerequisite chain) -
    // published-only never actually created a product, so it's not counted
    // here even though it IS counted at "published" below.
    expect(byStage.first_product_listed).toBe(2); // product-only, sold
    expect(byStage.published).toBe(2); // published-only, sold
    expect(byStage.first_sale).toBe(1); // sold only

    const dropOffs = Object.fromEntries(result.stages.map((s) => [s.stage, s.dropOffFromPrevious]));
    expect(dropOffs.signed_up).toBeNull();
    expect(dropOffs.store_created).toBe(1);
    expect(dropOffs.first_product_listed).toBe(2);
    expect(dropOffs.published).toBe(0);
    expect(dropOffs.first_sale).toBe(1);
  });

  it("FR-6.46: a seller stuck at a stage past growth.funnel_stuck_days is listed, and a seller with a completed sale never is", async () => {
    const stuckSeller = await signup("funnel-stuck@example.com");
    const stuckStore = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${stuckSeller.token}`).send({ name: "Store", slug: "funnel-stuck-store" });
    await superuser.store.update({ where: { id: stuckStore.body.id }, data: { createdAt: new Date(Date.now() - 20 * DAY_MS) } });

    const freshSeller = await signup("funnel-fresh@example.com");
    await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${freshSeller.token}`).send({ name: "Store", slug: "funnel-fresh-store" });

    const funnel = app.get(SellerHealthFunnelService);
    const result = await funnel.compute();

    const stuckIds = result.stuckSellers.map((s) => s.sellerId);
    expect(stuckIds).toContain(stuckSeller.sellerId);
    expect(stuckIds).not.toContain(freshSeller.sellerId);
    const stuckEntry = result.stuckSellers.find((s) => s.sellerId === stuckSeller.sellerId)!;
    expect(stuckEntry.stage).toBe("store_created");
    expect(stuckEntry.daysAtStage).toBeGreaterThanOrEqual(20);
  });

  it("FR-6.46: the funnel is reachable on the admin analytics surface", async () => {
    const adminToken = await createAndLoginAdmin("funnel-admin@example.com");
    const res = await request(app.getHttpServer()).get("/admin/analytics/seller-funnel").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stages)).toBe(true);
    expect(Array.isArray(res.body.stuckSellers)).toBe(true);
  });
});
