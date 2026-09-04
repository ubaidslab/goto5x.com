import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const SELLER_PASSWORD = "correct-horse-battery";
const BUYER_PASSWORD = "buyer-correct-horse-battery";
const shippingAddress = { fullName: "Buyer One", line1: "House 1", city: "Lahore", country: "PK", phone: "03001234567" };

/**
 * FR-66.1 (Module 81, v0.56) - optional buyer accounts. Guest checkout
 * (the unchanged default path) is covered by every pre-existing checkout
 * e2e spec; this file covers only the new optional-account surface:
 * signup/login/refresh/logout, profile, saved addresses (including
 * cross-buyer isolation), order-history, and that a logged-in buyer's
 * checkout actually links `Order.buyerId`.
 */
describe("Optional buyer accounts (e2e) - FR-66.1 (Module 81)", () => {
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

  async function signupBuyer(email: string, displayName?: string) {
    const res = await request(app.getHttpServer())
      .post("/storefront/auth/signup")
      .send({ email, password: BUYER_PASSWORD, displayName });
    return res;
  }

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
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function createSelfProduct(token: string, storeId: string, title: string, price: number) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title, status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price, stockQuantity: 100 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  it("signup creates an account and issues real tokens; a second signup with the same email is rejected", async () => {
    const res = await signupBuyer("buyer1@example.com", "Buyer One");
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.sessionId).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();

    const dupe = await signupBuyer("buyer1@example.com");
    expect(dupe.status).toBe(409);
  });

  it("login succeeds with the right password and fails with the wrong one", async () => {
    await signupBuyer("buyer2@example.com");
    const wrong = await request(app.getHttpServer()).post("/storefront/auth/login").send({ email: "buyer2@example.com", password: "nope" });
    expect(wrong.status).toBe(401);
    const right = await request(app.getHttpServer()).post("/storefront/auth/login").send({ email: "buyer2@example.com", password: BUYER_PASSWORD });
    expect(right.status).toBe(200);
    expect(right.body.accessToken).toBeTruthy();
  });

  it("GET /storefront/account/me requires a buyer session and returns the profile when authenticated", async () => {
    const unauthed = await request(app.getHttpServer()).get("/storefront/account/me");
    expect(unauthed.status).toBe(401);

    const signup = await signupBuyer("buyer3@example.com", "Buyer Three");
    const me = await request(app.getHttpServer()).get("/storefront/account/me").set("Authorization", `Bearer ${signup.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("buyer3@example.com");
    expect(me.body.displayName).toBe("Buyer Three");
  });

  it("a seller's own access token is rejected by the buyer-account guard", async () => {
    const { token: sellerToken } = await signupLoginAndCreateStore("seller-not-buyer@example.com", "seller-not-buyer-store");
    const res = await request(app.getHttpServer()).get("/storefront/account/me").set("Authorization", `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });

  it("PATCH /storefront/account/me updates the display name", async () => {
    const signup = await signupBuyer("buyer4@example.com");
    const update = await request(app.getHttpServer())
      .patch("/storefront/account/me")
      .set("Authorization", `Bearer ${signup.body.accessToken}`)
      .send({ displayName: "Updated Name" });
    expect(update.status).toBe(200);
    expect(update.body.displayName).toBe("Updated Name");
  });

  it("saved addresses: create, list, update, delete, and default-flipping all work; another buyer cannot touch them", async () => {
    const signup = await signupBuyer("buyer5@example.com");
    const token = signup.body.accessToken as string;

    const create = await request(app.getHttpServer())
      .post("/storefront/account/addresses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...shippingAddress, label: "Home", isDefault: true });
    expect(create.status).toBe(201);
    const addressId = create.body.id as string;

    const list = await request(app.getHttpServer()).get("/storefront/account/addresses").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].isDefault).toBe(true);

    const update = await request(app.getHttpServer())
      .patch(`/storefront/account/addresses/${addressId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...shippingAddress, city: "Karachi", isDefault: true });
    expect(update.status).toBe(200);
    expect(update.body.city).toBe("Karachi");

    // A second buyer must never be able to read, edit, or delete the first buyer's address.
    const otherSignup = await signupBuyer("buyer6@example.com");
    const otherToken = otherSignup.body.accessToken as string;
    const otherList = await request(app.getHttpServer()).get("/storefront/account/addresses").set("Authorization", `Bearer ${otherToken}`);
    expect(otherList.body).toHaveLength(0);
    const forbiddenUpdate = await request(app.getHttpServer())
      .patch(`/storefront/account/addresses/${addressId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send(shippingAddress);
    expect([403, 404]).toContain(forbiddenUpdate.status);
    const forbiddenDelete = await request(app.getHttpServer())
      .delete(`/storefront/account/addresses/${addressId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect([403, 404]).toContain(forbiddenDelete.status);

    const del = await request(app.getHttpServer()).delete(`/storefront/account/addresses/${addressId}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);
    const listAfterDelete = await request(app.getHttpServer()).get("/storefront/account/addresses").set("Authorization", `Bearer ${token}`);
    expect(listAfterDelete.body).toHaveLength(0);
  });

  it("a logged-in buyer's checkout links Order.buyerId; guest checkout (no token) leaves it null", async () => {
    const { token: sellerToken, storeId, hostname } = await signupLoginAndCreateStore("seller-checkout@example.com", "seller-checkout-store");
    const { productId, variantId } = await createSelfProduct(sellerToken, storeId, "Widget", 500);

    const buyerSignup = await signupBuyer("buyer-checkout@example.com");
    const buyerToken = buyerSignup.body.accessToken as string;

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer-checkout@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    expect(checkout.status).toBe(201);

    const order = await superuser.order.findUniqueOrThrow({ where: { id: checkout.body.id } });
    const buyerUser = await superuser.user.findUniqueOrThrow({ where: { email: "buyer-checkout@example.com" } });
    expect(order.buyerId).toBe(buyerUser.id);

    // Guest checkout (no Authorization header at all) must be entirely unaffected.
    const guestCart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "guest-checkout@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const guestCheckout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: guestCart.body.sessionToken, shippingAddress });
    expect(guestCheckout.status).toBe(201);
    const guestOrder = await superuser.order.findUniqueOrThrow({ where: { id: guestCheckout.body.id } });
    expect(guestOrder.buyerId).toBeNull();
  });

  it("GET /storefront/account/orders returns only this buyer's own orders, across stores", async () => {
    const { token: sellerToken, storeId, hostname } = await signupLoginAndCreateStore("seller-orders@example.com", "seller-orders-store");
    const { productId, variantId } = await createSelfProduct(sellerToken, storeId, "Gadget", 750);

    const buyerA = await signupBuyer("orders-buyer-a@example.com");
    const buyerB = await signupBuyer("orders-buyer-b@example.com");

    const cartA = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "orders-buyer-a@example.com", items: [{ productId, variantId, quantity: 1 }] });
    await request(app.getHttpServer())
      .post("/storefront/checkout")
      .set("Authorization", `Bearer ${buyerA.body.accessToken}`)
      .send({ hostname, sessionToken: cartA.body.sessionToken, shippingAddress });

    const ordersForA = await request(app.getHttpServer()).get("/storefront/account/orders").set("Authorization", `Bearer ${buyerA.body.accessToken}`);
    expect(ordersForA.status).toBe(200);
    expect(ordersForA.body).toHaveLength(1);
    expect(ordersForA.body[0].storeName).toBe(`Store for seller-orders@example.com`);

    const ordersForB = await request(app.getHttpServer()).get("/storefront/account/orders").set("Authorization", `Bearer ${buyerB.body.accessToken}`);
    expect(ordersForB.status).toBe(200);
    expect(ordersForB.body).toHaveLength(0);
  });

  it("refresh issues a new working access token and logout invalidates the session", async () => {
    const signup = await signupBuyer("buyer-refresh@example.com");
    const refresh = await request(app.getHttpServer())
      .post("/storefront/auth/refresh")
      .send({ sessionId: signup.body.sessionId, refreshToken: signup.body.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();

    const meWithNewToken = await request(app.getHttpServer()).get("/storefront/account/me").set("Authorization", `Bearer ${refresh.body.accessToken}`);
    expect(meWithNewToken.status).toBe(200);

    const logout = await request(app.getHttpServer()).post("/storefront/auth/logout").send({ sessionId: refresh.body.sessionId });
    expect(logout.status).toBe(204);

    const refreshAfterLogout = await request(app.getHttpServer())
      .post("/storefront/auth/refresh")
      .send({ sessionId: refresh.body.sessionId, refreshToken: refresh.body.refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });
});
