import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 32 (SRS §5.49, §14.49) - Gift Cards. Mirrors DiscountCode's
 * store-scoped unique-code pattern plus a wallet-ledger-style derived
 * balance; the Financial Truth Invariant (§3.12) applies to the
 * buyer-purchase path exactly as it does to every other revenue event.
 */
describe("Gift Cards (e2e) - SRS §5.49, §14.49", () => {
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

  const shippingAddress = {
    fullName: "Ayesha Khan",
    line1: "House 12, Street 3",
    city: "Lahore",
    country: "PK",
    phone: "03001234567",
  };

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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    // Same checkout-prerequisite precedent as orders.e2e-spec.ts - not this file's focus.
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId, hostname: `${slug}.goto5x.com` };
  }

  async function createSelfProduct(token: string, storeId: string, price: number, stockQuantity = 100) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function checkoutWithGiftCard(hostname: string, productId: string, variantId: string, giftCardCode?: string) {
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    return request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress, giftCardCode });
  }

  it("FR-49.2/49.4: seller-issued gift card is active immediately, with a derived balance equal to its initial value", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("issue@example.com", "issue-store");
    const res = await request(app.getHttpServer())
      .post(`/stores/${storeId}/gift-cards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 500, note: "Goodwill credit" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("active");
    expect(res.body.source).toBe("seller_issued");
    expect(res.body.remainingBalance).toBe("500");
    expect(res.body.activatedAt).not.toBeNull();
  });

  it("FR-49.3 (Financial Truth Invariant): a buyer-purchased gift card is pending_payment and unusable until the seller confirms payment", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("purchase@example.com", "purchase-store");
    const { productId, variantId } = await createSelfProduct(token, storeId, 1000);

    const purchase = await request(app.getHttpServer())
      .post("/storefront/gift-cards/purchase")
      .send({ hostname, amount: 300, buyerEmail: "giftbuyer@example.com" });
    expect(purchase.status).toBe(201);
    expect(purchase.body.status).toBe("pending_payment");
    const code = purchase.body.code as string;
    const giftCardId = purchase.body.id as string;

    // Unusable while still pending payment.
    const rejectedCheckout = await checkoutWithGiftCard(hostname, productId, variantId, code);
    expect(rejectedCheckout.status).toBe(400);

    const confirm = await request(app.getHttpServer())
      .post(`/stores/${storeId}/gift-cards/${giftCardId}/confirm-paid`)
      .set("Authorization", `Bearer ${token}`);
    expect(confirm.status).toBe(201);
    expect(confirm.body.status).toBe("active");

    // Confirming a second time is rejected (not awaiting payment anymore).
    const confirmAgain = await request(app.getHttpServer())
      .post(`/stores/${storeId}/gift-cards/${giftCardId}/confirm-paid`)
      .set("Authorization", `Bearer ${token}`);
    expect(confirmAgain.status).toBe(400);

    // Now usable at checkout.
    const acceptedCheckout = await checkoutWithGiftCard(hostname, productId, variantId, code);
    expect(acceptedCheckout.status).toBe(201);
  });

  it("FR-49.4/49.5/49.6: partial redemption across two orders decrements the derived balance and never touches totalAmount/commission", async () => {
    const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("redeem@example.com", "redeem-store");
    // Default shipping (flatRate 0) and tax (rate 0) settings mean
    // totalAmount == product price exactly - chosen deliberately so the
    // redemption math below is exact and easy to reason about.
    const cheap = await createSelfProduct(token, storeId, 60);
    const pricier = await createSelfProduct(token, storeId, 200);

    const issued = await request(app.getHttpServer())
      .post(`/stores/${storeId}/gift-cards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 150 });
    const code = issued.body.code as string;

    const first = await checkoutWithGiftCard(hostname, cheap.productId, cheap.variantId, code);
    expect(first.status).toBe(201);
    // FR-49.5 - totalAmount is the full order total, unreduced by the gift
    // card; giftCardAmount is the separate payment-reduction field.
    expect(first.body.totalAmount).toBe("60");
    expect(first.body.giftCardAmount).toBe("60"); // order total (60) < remaining balance (150), so the whole order is covered

    const afterFirst = await superuser.giftCard.findUniqueOrThrow({ where: { id: issued.body.id } });
    expect(Number(afterFirst.remainingBalance)).toBeCloseTo(90, 2);
    expect(afterFirst.status).toBe("active");

    const second = await checkoutWithGiftCard(hostname, pricier.productId, pricier.variantId, code);
    expect(second.status).toBe(201);
    expect(second.body.totalAmount).toBe("200");
    // The remaining 90 is all that's left, capped there even though the order total (200) is larger.
    expect(second.body.giftCardAmount).toBe("90");

    const afterSecond = await superuser.giftCard.findUniqueOrThrow({ where: { id: issued.body.id } });
    expect(Number(afterSecond.remainingBalance)).toBe(0);
    expect(afterSecond.status).toBe("depleted");

    // A now-depleted code is rejected outright.
    const third = await checkoutWithGiftCard(hostname, cheap.productId, cheap.variantId, code);
    expect(third.status).toBe(400);

    // FR-49.5 - mark the first order paid and confirm commission accrues on
    // the full totalAmount, unaffected by the gift card redemption.
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${first.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    const ledgerEntries = await superuser.ledgerEntry.findMany({ where: { sellerId, orderId: first.body.id } });
    const commission = ledgerEntries.find((e) => e.type === "commission_accrued");
    expect(commission).toBeDefined();
    // Default commission rate is 1% (FR-7.4); base = totalAmount - taxAmount = 60 - 0.
    expect(Number(commission!.amount)).toBeCloseTo(0.6, 2);
  });

  it("FR-49.7: RLS denies cross-tenant access to another store's gift cards", async () => {
    const a = await signupLoginAndCreateStore("gc-tenant-a@example.com", "gc-tenant-a-store");
    const b = await signupLoginAndCreateStore("gc-tenant-b@example.com", "gc-tenant-b-store");

    const issued = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/gift-cards`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ amount: 200 });

    const crossTenantGet = await request(app.getHttpServer())
      .get(`/stores/${a.storeId}/gift-cards/${issued.body.id}`)
      .set("Authorization", `Bearer ${b.token}`);
    expect(crossTenantGet.status).toBe(404);

    const crossTenantConfirm = await request(app.getHttpServer())
      .post(`/stores/${a.storeId}/gift-cards/${issued.body.id}/confirm-paid`)
      .set("Authorization", `Bearer ${b.token}`);
    // RLS hides the row entirely from seller B's session (404), never a 400
    // that would imply the row was visible but merely rejected.
    expect(crossTenantConfirm.status).toBe(404);

    // A gift card code from store A can never be redeemed against store B's checkout.
    const { productId, variantId } = await createSelfProduct(b.token, b.storeId, 500);
    const crossStoreRedeem = await checkoutWithGiftCard(b.hostname, productId, variantId, issued.body.code);
    expect(crossStoreRedeem.status).toBe(400);
  });

  it("FR-49.1: a duplicate seller-chosen code within the same store is rejected", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("dup-code@example.com", "dup-code-store");
    const first = await request(app.getHttpServer())
      .post(`/stores/${storeId}/gift-cards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, code: "SUMMER25" });
    expect(first.status).toBe(201);

    const dup = await request(app.getHttpServer())
      .post(`/stores/${storeId}/gift-cards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, code: "SUMMER25" });
    expect(dup.status).toBe(409);
  });
});
