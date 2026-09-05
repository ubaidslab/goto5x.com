import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const SELLER_PASSWORD = "correct-horse-battery";
const BUYER_PASSWORD = "buyer-correct-horse-battery";

/**
 * FR-66.5 (Module 85) - wishlist/save-for-later, plan-gated RISE+FLY the
 * same way as the live chat widget (FR-66.3). Account-gated only (see the
 * schema.prisma doc comment on BuyerWishlistItem for why there's no guest
 * equivalent).
 */
describe("Wishlist / save for later (e2e) - FR-66.5 (Module 85)", () => {
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
      .send({ agreementAccepted: true, email, password: SELLER_PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: SELLER_PASSWORD });
    const token = login.body.accessToken as string;
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId };
  }

  async function createSelfProduct(token: string, storeId: string, title: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title, status: "active" });
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    return product.body.id as string;
  }

  async function upgradeToRise(sellerId: string) {
    const risePlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: risePlan.id } });
  }

  async function signupBuyer(email: string) {
    const res = await request(app.getHttpServer())
      .post("/storefront/auth/signup")
      .send({ email, password: BUYER_PASSWORD });
    return res.body.accessToken as string;
  }

  it("a GO-tier store's product rejects a wishlist add; a RISE-tier store's accepts it", async () => {
    const { token: sellerToken, storeId, sellerId } = await signupLoginAndCreateStore("wishlist-go@example.com", "wishlist-go-store");
    const productId = await createSelfProduct(sellerToken, storeId, "Widget", 100);
    const buyerToken = await signupBuyer("wishlist-go-buyer@example.com");

    const rejected = await request(app.getHttpServer())
      .post("/storefront/account/wishlist")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ productId });
    expect(rejected.status).toBe(403);

    await upgradeToRise(sellerId);
    const accepted = await request(app.getHttpServer())
      .post("/storefront/account/wishlist")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ productId });
    expect(accepted.status).toBe(201);
  });

  it("adding, listing, checking, and removing a wishlist item all work, and adding twice is idempotent", async () => {
    const { token: sellerToken, storeId, sellerId } = await signupLoginAndCreateStore("wishlist-rise@example.com", "wishlist-rise-store");
    await upgradeToRise(sellerId);
    const productId = await createSelfProduct(sellerToken, storeId, "Nice Jacket", 250);
    const buyerToken = await signupBuyer("wishlist-rise-buyer@example.com");

    const notYet = await request(app.getHttpServer())
      .get(`/storefront/account/wishlist/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(notYet.body).toEqual({ wishlisted: false });

    const add1 = await request(app.getHttpServer())
      .post("/storefront/account/wishlist")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ productId });
    expect(add1.status).toBe(201);
    // Idempotent - adding the same product again must not error or duplicate.
    const add2 = await request(app.getHttpServer())
      .post("/storefront/account/wishlist")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ productId });
    expect(add2.status).toBe(201);

    const now = await request(app.getHttpServer())
      .get(`/storefront/account/wishlist/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(now.body).toEqual({ wishlisted: true });

    const list = await request(app.getHttpServer()).get("/storefront/account/wishlist").set("Authorization", `Bearer ${buyerToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ productId, title: "Nice Jacket", price: 250, storeSlug: "wishlist-rise-store" });

    const remove = await request(app.getHttpServer())
      .delete(`/storefront/account/wishlist/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(remove.status).toBe(204);
    // Idempotent - removing an already-removed item must still succeed, not 404.
    const removeAgain = await request(app.getHttpServer())
      .delete(`/storefront/account/wishlist/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(removeAgain.status).toBe(204);

    const listAfter = await request(app.getHttpServer()).get("/storefront/account/wishlist").set("Authorization", `Bearer ${buyerToken}`);
    expect(listAfter.body).toHaveLength(0);
  });

  it("one buyer's wishlist never includes another buyer's saved items", async () => {
    const { token: sellerToken, storeId, sellerId } = await signupLoginAndCreateStore("wishlist-isolation@example.com", "wishlist-isolation-store");
    await upgradeToRise(sellerId);
    const productId = await createSelfProduct(sellerToken, storeId, "Shared Product", 40);

    const buyerAToken = await signupBuyer("wishlist-buyer-a@example.com");
    const buyerBToken = await signupBuyer("wishlist-buyer-b@example.com");

    await request(app.getHttpServer())
      .post("/storefront/account/wishlist")
      .set("Authorization", `Bearer ${buyerAToken}`)
      .send({ productId });

    const buyerBList = await request(app.getHttpServer()).get("/storefront/account/wishlist").set("Authorization", `Bearer ${buyerBToken}`);
    expect(buyerBList.body).toHaveLength(0);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app.getHttpServer()).get("/storefront/account/wishlist");
    expect(res.status).toBe(401);
  });
});
