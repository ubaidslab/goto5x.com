import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * Module 91 (SRS §5.67, §14.69) - Deals & Bundles. A seller-created bundle
 * of their own products sold together at one uniform percentage off,
 * live-computed at checkout time and reusing the existing checkout
 * pipeline via a buy-now cart hand-off (FR-67.2), never a parallel
 * order-creation path.
 */
describe("Deals & Bundles (e2e) - SRS §5.67, §14.69", () => {
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

  const PASSWORD = "correct-horse-battery";
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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId, hostname: `${slug}.uzeyn.com` };
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

  async function createActiveDeal(
    token: string,
    storeId: string,
    items: { productId: string; variantId: string }[],
    discountPercent = 20,
  ) {
    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/deals`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Steal Deal",
        slug: `steal-deal-${Date.now()}`,
        discountPercent,
        items: items.map((i, index) => ({ productId: i.productId, variantId: i.variantId, sortOrder: index })),
      });
    expect(create.status).toBe(201);
    const activate = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/deals/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "active" });
    expect(activate.status).toBe(200);
    return create.body.id as string;
  }

  it("FR-67.1: creating a deal rejects an item from another store", async () => {
    const seller = await signupLoginAndCreateStore("deal-owner@example.com", "deal-owner-store");
    const other = await signupLoginAndCreateStore("deal-intruder@example.com", "deal-intruder-store");
    const { productId, variantId } = await createSelfProduct(other.token, other.storeId, 1000);

    const res = await request(app.getHttpServer())
      .post(`/stores/${seller.storeId}/deals`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ title: "Cross-store deal", slug: "cross-store-deal", discountPercent: 10, items: [{ productId, variantId }] });

    expect(res.status).toBe(404);
  });

  it("FR-67.1: another seller cannot read or edit a deal that isn't theirs (RLS)", async () => {
    const seller = await signupLoginAndCreateStore("deal-a@example.com", "deal-a-store");
    const intruder = await signupLoginAndCreateStore("deal-b@example.com", "deal-b-store");
    const { productId, variantId } = await createSelfProduct(seller.token, seller.storeId, 1000);
    const dealId = await createActiveDeal(seller.token, seller.storeId, [{ productId, variantId }]);

    const read = await request(app.getHttpServer())
      .get(`/stores/${seller.storeId}/deals/${dealId}`)
      .set("Authorization", `Bearer ${intruder.token}`);
    expect(read.status).toBe(404);

    const patch = await request(app.getHttpServer())
      .patch(`/stores/${seller.storeId}/deals/${dealId}`)
      .set("Authorization", `Bearer ${intruder.token}`)
      .send({ discountPercent: 99 });
    expect(patch.status).toBe(404);
  });

  it("FR-67.2/67.3: a draft deal never appears on the public storefront listing; an active one does", async () => {
    const seller = await signupLoginAndCreateStore("deal-visible@example.com", "deal-visible-store");
    const { productId, variantId } = await createSelfProduct(seller.token, seller.storeId, 1000);

    const draft = await request(app.getHttpServer())
      .post(`/stores/${seller.storeId}/deals`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ title: "Still Draft", slug: "still-draft", discountPercent: 15, items: [{ productId, variantId }] });
    expect(draft.status).toBe(201);

    const listBeforeActivate = await request(app.getHttpServer()).get(`/storefront/deals?hostname=${seller.hostname}`);
    expect(listBeforeActivate.status).toBe(200);
    expect(listBeforeActivate.body).toHaveLength(0);

    await request(app.getHttpServer())
      .patch(`/stores/${seller.storeId}/deals/${draft.body.id}`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ status: "active" });

    const listAfterActivate = await request(app.getHttpServer()).get(`/storefront/deals?hostname=${seller.hostname}`);
    expect(listAfterActivate.body).toHaveLength(1);
    expect(listAfterActivate.body[0].id).toBe(draft.body.id);
  });

  it("FR-67.2: buy-now -> checkout applies the live-computed uniform percentage discount, never a snapshot", async () => {
    const seller = await signupLoginAndCreateStore("deal-buy@example.com", "deal-buy-store");
    const itemA = await createSelfProduct(seller.token, seller.storeId, 1000);
    const itemB = await createSelfProduct(seller.token, seller.storeId, 500);
    const dealId = await createActiveDeal(seller.token, seller.storeId, [itemA, itemB], 20);

    // Live-computed: raise itemA's price AFTER the deal was created but
    // BEFORE buy-now - the discount must apply to the new price, proving
    // nothing was snapshotted at deal-creation time.
    await request(app.getHttpServer())
      .patch(`/stores/${seller.storeId}/products/${itemA.productId}/variants/${itemA.variantId}`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ price: 1200 });

    const buyNow = await request(app.getHttpServer())
      .post(`/storefront/deals/${dealId}/buy-now`)
      .send({ hostname: seller.hostname, buyerEmail: "buyer@example.com" });
    expect(buyNow.status).toBe(201);
    expect(buyNow.body.discountPercent).toBe(20);

    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname: seller.hostname, sessionToken: buyNow.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);

    // Subtotal = 1200 (updated price) + 500 = 1700; 20% off = 340.
    expect(checkout.body.discountAmount).toBe("340");
    expect(checkout.body.dealId).toBe(dealId);
  });

  it("FR-67.2: editing a buy-now cart's items forfeits the deal discount (closes the pad-in-extra-items abuse vector)", async () => {
    const seller = await signupLoginAndCreateStore("deal-abuse@example.com", "deal-abuse-store");
    const dealItem = await createSelfProduct(seller.token, seller.storeId, 1000);
    const outsideItem = await createSelfProduct(seller.token, seller.storeId, 5000);
    const dealId = await createActiveDeal(seller.token, seller.storeId, [dealItem], 50);

    const buyNow = await request(app.getHttpServer())
      .post(`/storefront/deals/${dealId}/buy-now`)
      .send({ hostname: seller.hostname, buyerEmail: "buyer@example.com" });
    expect(buyNow.status).toBe(201);

    // Buyer pads in an unrelated, expensive product via the ordinary cart-update endpoint.
    const update = await request(app.getHttpServer())
      .patch(`/storefront/cart/${buyNow.body.sessionToken}`)
      .send({
        hostname: seller.hostname,
        items: [
          { productId: dealItem.productId, variantId: dealItem.variantId, quantity: 1 },
          { productId: outsideItem.productId, variantId: outsideItem.variantId, quantity: 1 },
        ],
      });
    expect(update.status).toBe(200);

    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname: seller.hostname, sessionToken: buyNow.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);
    // No discount at all - the deal was forfeited the moment the cart's items changed.
    expect(checkout.body.discountAmount).toBe("0");
    expect(checkout.body.dealId).toBeNull();
  });

  it("FR-67.2: if any deal item is out of stock, the whole deal purchase is blocked (reuses Module 46's atomic guard)", async () => {
    const seller = await signupLoginAndCreateStore("deal-oos@example.com", "deal-oos-store");
    const inStock = await createSelfProduct(seller.token, seller.storeId, 1000, 10);
    const outOfStock = await createSelfProduct(seller.token, seller.storeId, 1000, 0);
    const dealId = await createActiveDeal(seller.token, seller.storeId, [inStock, outOfStock], 20);

    const buyNow = await request(app.getHttpServer())
      .post(`/storefront/deals/${dealId}/buy-now`)
      .send({ hostname: seller.hostname, buyerEmail: "buyer@example.com" });
    expect(buyNow.status).toBe(201);

    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname: seller.hostname, sessionToken: buyNow.body.sessionToken, shippingAddress });
    expect([400, 409]).toContain(checkout.status);

    // The in-stock item's stock must be untouched - no partial reservation survives the rejection.
    const variant = await superuser.productVariant.findUniqueOrThrow({ where: { id: inStock.variantId } });
    expect(variant.stockQuantity).toBe(10);
  });

  it("FR-67.4: the 'in an active deal' product-list filter chip only returns products in an active deal", async () => {
    const seller = await signupLoginAndCreateStore("deal-filter@example.com", "deal-filter-store");
    const bundled = await createSelfProduct(seller.token, seller.storeId, 1000);
    const notBundled = await createSelfProduct(seller.token, seller.storeId, 1000);
    await createActiveDeal(seller.token, seller.storeId, [bundled], 10);

    const filtered = await request(app.getHttpServer())
      .get(`/stores/${seller.storeId}/products?inActiveDeal=true`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(filtered.status).toBe(200);
    const ids = filtered.body.items.map((p: { id: string }) => p.id);
    expect(ids).toContain(bundled.productId);
    expect(ids).not.toContain(notBundled.productId);
  });

  it("FR-67.5: deal-performance analytics only counts CONFIRMED_OR_BEYOND orders, attributed to the right deal", async () => {
    const seller = await signupLoginAndCreateStore("deal-analytics@example.com", "deal-analytics-store");
    const item = await createSelfProduct(seller.token, seller.storeId, 1000);
    const dealId = await createActiveDeal(seller.token, seller.storeId, [item], 10);

    const buyNow = await request(app.getHttpServer())
      .post(`/storefront/deals/${dealId}/buy-now`)
      .send({ hostname: seller.hostname, buyerEmail: "buyer@example.com" });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname: seller.hostname, sessionToken: buyNow.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);

    // Still pending - must not show up yet (Financial Truth Invariant).
    const beforeConfirm = await request(app.getHttpServer())
      .get(`/stores/${seller.storeId}/analytics/deal-performance`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(beforeConfirm.body).toHaveLength(0);

    await request(app.getHttpServer())
      .post(`/stores/${seller.storeId}/orders/${checkout.body.id}/mark-as-paid`)
      .set("Authorization", `Bearer ${seller.token}`);

    const afterConfirm = await request(app.getHttpServer())
      .get(`/stores/${seller.storeId}/analytics/deal-performance`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(afterConfirm.body).toHaveLength(1);
    expect(afterConfirm.body[0].dealId).toBe(dealId);
    expect(afterConfirm.body[0].orders).toBe(1);
    expect(afterConfirm.body[0].units).toBe(1);
  });

  it("FR-67.1: a duplicate slug in the same store is rejected with 409, not a 500", async () => {
    const seller = await signupLoginAndCreateStore("deal-slug@example.com", "deal-slug-store");
    const item = await createSelfProduct(seller.token, seller.storeId, 1000);

    const first = await request(app.getHttpServer())
      .post(`/stores/${seller.storeId}/deals`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ title: "First", slug: "same-slug", discountPercent: 10, items: [{ productId: item.productId, variantId: item.variantId }] });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/stores/${seller.storeId}/deals`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ title: "Second", slug: "same-slug", discountPercent: 10, items: [{ productId: item.productId, variantId: item.variantId }] });
    expect(second.status).toBe(409);
  });
});
