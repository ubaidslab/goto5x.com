import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const BUYER_PASSWORD = "buyer-correct-horse-battery";

/**
 * P1.4 (docs/security-audit-report.md) - malformed/boundary/oversized input
 * across the endpoints this sweep found and fixed. Every case here proves a
 * real 400 from the ValidationPipe against a running app, not a code-reading
 * inference - the same standard as the P0/P1.3 fixes.
 */
describe("Input validation sweep (e2e) - P1.4", () => {
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
    // Same prerequisite simplification orders.e2e-spec.ts's own helper
    // documents - not this file's focus, just needed to reach the DTO
    // under test without moderation/checkout-readiness getting in the way.
    await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { userId: user.id }, data: { cnicHash: `test-cnic-hash-${user.id}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  describe("Previously-untyped @Body() endpoints now behind real DTOs", () => {
    it("POST /auth/refresh: a malformed body (wrong types, missing fields) is rejected with 400, not a 500 from downstream type confusion", async () => {
      const wrongTypes = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ sessionId: { nested: "object" }, refreshToken: 12345 });
      expect(wrongTypes.status).toBe(400);

      const missingField = await request(app.getHttpServer()).post("/auth/refresh").send({ sessionId: "not-a-uuid" });
      expect(missingField.status).toBe(400);

      const notAUuid = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ sessionId: "not-a-uuid", refreshToken: "some-token" });
      expect(notAUuid.status).toBe(400);
    });

    it("POST /auth/logout, /storefront/auth/logout: a non-UUID or wrong-typed sessionId is rejected with 400", async () => {
      const sellerLogout = await request(app.getHttpServer()).post("/auth/logout").send({ sessionId: ["array", "not", "string"] });
      expect(sellerLogout.status).toBe(400);

      const buyerLogout = await request(app.getHttpServer()).post("/storefront/auth/logout").send({ sessionId: "not-a-uuid" });
      expect(buyerLogout.status).toBe(400);
    });

    it("POST /admin/auth/mfa/enroll: a wrong-typed preAuthToken is rejected with 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/admin/auth/mfa/enroll")
        .send({ preAuthToken: { not: "a string" } });
      expect(res.status).toBe(400);
    });

    it("PATCH /storefront/account/me: an oversized displayName (>120 chars) is rejected with 400; a wrong-typed one too", async () => {
      const signup = await request(app.getHttpServer())
        .post("/storefront/auth/signup")
        .send({ email: "validation-buyer@example.com", password: BUYER_PASSWORD });
      const buyerToken = signup.body.accessToken as string;

      const oversized = await request(app.getHttpServer())
        .patch("/storefront/account/me")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({ displayName: "x".repeat(121) });
      expect(oversized.status).toBe(400);

      const wrongType = await request(app.getHttpServer())
        .patch("/storefront/account/me")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({ displayName: 12345 });
      expect(wrongType.status).toBe(400);

      // The boundary itself still works - exactly 120 chars is accepted.
      const atBoundary = await request(app.getHttpServer())
        .patch("/storefront/account/me")
        .set("Authorization", `Bearer ${buyerToken}`)
        .send({ displayName: "x".repeat(120) });
      expect(atBoundary.status).toBe(200);
    });
  });

  describe("Boundary/oversized numeric and array input", () => {
    it("creating a variant with a negative, non-numeric, or Decimal(12,2)-exceeding price is rejected with 400", async () => {
      const { token, storeId } = await signupLoginAndCreateStore("validation-price@example.com", "validation-price-store");
      const product = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Widget" });

      const negative = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sku: "SKU-NEG", price: -10, stockQuantity: 10 });
      expect(negative.status).toBe(400);

      const nonNumeric = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sku: "SKU-NAN", price: "not-a-number", stockQuantity: 10 });
      expect(nonNumeric.status).toBe(400);

      // Beyond Decimal(12,2)'s range - previously would have reached Postgres
      // and failed as an unhandled 500 (numeric field overflow) instead of a
      // clean 400 from the ValidationPipe.
      const tooLarge = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sku: "SKU-HUGE", price: 99999999999999, stockQuantity: 10 });
      expect(tooLarge.status).toBe(400);

      // A real, in-range price still works.
      const valid = await request(app.getHttpServer())
        .post(`/stores/${storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sku: "SKU-OK", price: 500, stockQuantity: 10 });
      expect(valid.status).toBe(201);
    });

    it("a cart item's quantity beyond the sanity ceiling, and a cart with too many distinct items, are both rejected with 400", async () => {
      const seller = await signupLoginAndCreateStore("validation-cart@example.com", "validation-cart-store");
      const product = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/products`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ title: "Cart Widget", status: "active" });
      const variant = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/products/${product.body.id}/variants`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ sku: "SKU-CART", price: 100, stockQuantity: 999999 });
      const hostname = seller.hostname;

      const absurdQuantity = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({
          hostname,
          buyerEmail: "cart-buyer@example.com",
          items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 100_001 }],
        });
      expect(absurdQuantity.status).toBe(400);

      const tooManyItems = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({
          hostname,
          buyerEmail: "cart-buyer-2@example.com",
          items: Array.from({ length: 101 }, () => ({ productId: product.body.id, variantId: variant.body.id, quantity: 1 })),
        });
      expect(tooManyItems.status).toBe(400);

      // A real, in-bounds cart still works.
      const valid = await request(app.getHttpServer())
        .post("/storefront/cart")
        .send({
          hostname,
          buyerEmail: "cart-buyer-3@example.com",
          items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 2 }],
        });
      expect(valid.status).toBe(201);
    });

    it("a gift-card purchase, wallet top-up request, and discount-code value beyond Decimal(12,2)'s range are all rejected with 400", async () => {
      // Gift-card purchase is public/unauthenticated (PurchaseGiftCardDto's
      // own docstring) - the highest-exposure of the three, and previously
      // had no upper bound on amount at all, not even the ceiling
      // create-variant.dto.ts already had.
      const seller = await signupLoginAndCreateStore("validation-money@example.com", "validation-money-store");

      const giftCardTooLarge = await request(app.getHttpServer())
        .post("/storefront/gift-cards/purchase")
        .send({ hostname: seller.hostname, amount: 99999999999999, buyerEmail: "gc-buyer@example.com" });
      expect(giftCardTooLarge.status).toBe(400);

      const topUpTooLarge = await request(app.getHttpServer())
        .post("/sellers/me/wallet/topup-requests")
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ amount: 99999999999999 });
      expect(topUpTooLarge.status).toBe(400);

      const discountTooLarge = await request(app.getHttpServer())
        .post(`/stores/${seller.storeId}/discount-codes`)
        .set("Authorization", `Bearer ${seller.token}`)
        .send({ code: "HUGE10", type: "fixed_amount", value: 99999999999999 });
      expect(discountTooLarge.status).toBe(400);
    });
  });

  describe("Malformed request bodies generally", () => {
    it("a JSON array sent where an object is expected is rejected with 400, not treated as an empty/valid DTO", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send([1, 2, 3] as unknown as object);
      expect(res.status).toBe(400);
    });

    it("an oversized JSON body is rejected with 413, never reaching a handler and never surfacing as a 500", async () => {
      // P1.4 finding, fixed alongside this test: body-parser's own
      // PayloadTooLargeError previously fell through the global exception
      // filter's generic branch and came back as a 500 - the size limit
      // itself was already enforced, just with the wrong status code.
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "a@example.com", password: "x", junk: "y".repeat(200_000) });
      expect(res.status).toBe(413);
    });
  });
});
