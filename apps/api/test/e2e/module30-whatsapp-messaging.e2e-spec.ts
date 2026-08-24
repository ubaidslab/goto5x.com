import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 30 (SRS §5.41, §14.41) - WhatsApp Semi-Automation. Every generator
 * reuses existing machinery (order status/tracking uploads from Modules 9/
 * 27, abandoned-cart flagging from Module 9/15.2, the `wa.me` construction
 * from Module 26's WhatsAppOtpAdapter) - v1.0 never sends anything itself,
 * every endpoint just returns a deep link for the seller to tap-send.
 */
describe("WhatsApp Semi-Automation (e2e) - SRS §5.41, §14.41", () => {
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
    // Same isTrusted precedent used across this suite (e.g. module15/module26 e2e specs) - skips the new-seller probation moderation queue, not this module's concern.
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    // Checkout prerequisites this module doesn't test (Module 11/12/20's own concerns) - same precedent as orders.e2e-spec.ts: enable COD, set a synthetic CNIC hash, and publish the store directly.
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId, userId: user.id as string };
  }

  async function createProductWithVariant(token: string, storeId: string, sku: string, price = 500) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: `Product ${sku}`, status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku, price, stockQuantity: 100 });
    return { productId: product.body.id as string, variantId: variant.body.id as string };
  }

  async function createManualOrder(token: string, storeId: string, variantId: string, productId: string, buyerWhatsapp?: string) {
    const order = await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        buyerEmail: "buyer@example.com",
        buyerWhatsapp,
        shippingAddress: { fullName: "Buyer One", line1: "1 Main St", city: "Lahore", country: "PK", phone: "03001234567" },
        items: [{ productId, variantId, quantity: 1 }],
      });
    if (!order.body?.id) throw new Error(`createManualOrder failed: ${order.status} ${JSON.stringify(order.body)}`);
    return order.body.id as string;
  }

  it("FR-41.1a: an order confirmation deep link is only available once the order is confirmed, and never for an order with no WhatsApp number", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("wa-confirm@example.com", "wa-confirm-store");
    const { productId, variantId } = await createProductWithVariant(token, storeId, "WA-SKU-1");
    const orderId = await createManualOrder(token, storeId, variantId, productId, "+92 300 1112222");

    const tooEarly = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/orders/${orderId}/confirmation-link`)
      .set("Authorization", `Bearer ${token}`);
    expect(tooEarly.status).toBe(400);

    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);

    const link = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/orders/${orderId}/confirmation-link`)
      .set("Authorization", `Bearer ${token}`);
    expect(link.status).toBe(200);
    expect(link.body.deepLink).toMatch(/^https:\/\/wa\.me\/923001112222\?text=/);
    const decoded = decodeURIComponent(link.body.deepLink.split("?text=")[1]);
    expect(decoded).toContain(orderId.slice(0, 8).toUpperCase());
    expect(decoded).toContain("Store for wa-confirm@example.com");

    // No WhatsApp number captured - a second order with the same product, never given one.
    const noNumberOrder = await createManualOrder(token, storeId, variantId, productId, undefined);
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${noNumberOrder}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);
    const missing = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/orders/${noNumberOrder}/confirmation-link`)
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(400);
  });

  it("FR-41.1b: a shipping-update deep link is only available once tracking is uploaded, and includes the tracking ID", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("wa-ship@example.com", "wa-ship-store");
    const { productId, variantId } = await createProductWithVariant(token, storeId, "WA-SKU-2");
    const orderId = await createManualOrder(token, storeId, variantId, productId, "03001112222");
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`)
      .set("Authorization", `Bearer ${token}`);

    const tooEarly = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/orders/${orderId}/shipping-update-link`)
      .set("Authorization", `Bearer ${token}`);
    expect(tooEarly.status).toBe(400);

    const orderDetail = await request(app.getHttpServer())
      .get(`/stores/${storeId}/orders/${orderId}`)
      .set("Authorization", `Bearer ${token}`);
    const itemId = orderDetail.body.items[0].id as string;
    await request(app.getHttpServer())
      .post(`/stores/${storeId}/orders/${orderId}/items/${itemId}/tracking`)
      .set("Authorization", `Bearer ${token}`)
      .send({ trackingId: "TRACK123", carrier: "TCS" });

    const link = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/orders/${orderId}/shipping-update-link`)
      .set("Authorization", `Bearer ${token}`);
    expect(link.status).toBe(200);
    const decoded = decodeURIComponent(link.body.deepLink.split("?text=")[1]);
    expect(decoded).toContain("TRACK123");
    expect(decoded).toContain("TCS");
  });

  it("FR-41.1c/FR-41.2: an abandoned cart with a captured WhatsApp number is listed as actionable and generates a recovery link with an item summary", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreateStore("wa-cart@example.com", "wa-cart-store");
    const hostname = "wa-cart-store.uzeyn.com";
    const { productId, variantId } = await createProductWithVariant(token, storeId, "WA-SKU-3");

    // FR-41.2 - buyerWhatsapp is captured at cart-creation time, the same request as buyerEmail.
    const cartCreate = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({
        hostname,
        buyerEmail: "cart-buyer@example.com",
        buyerWhatsapp: "0300-9998888",
        items: [{ productId, variantId, quantity: 2 }],
      });
    expect(cartCreate.status).toBe(201);
    const stored = await superuser.cart.findUniqueOrThrow({ where: { sessionToken: cartCreate.body.sessionToken } });
    expect(stored.buyerWhatsapp).toBe("0300-9998888");

    await superuser.cart.update({ where: { id: stored.id }, data: { status: "abandoned" } });

    const list = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/carts/abandoned`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ hasWhatsapp: true, itemCount: 2 });

    const link = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/carts/${stored.id}/recovery-link`)
      .set("Authorization", `Bearer ${token}`);
    expect(link.status).toBe(200);
    expect(link.body.deepLink).toMatch(/^https:\/\/wa\.me\/03009998888\?text=/);
    const decoded = decodeURIComponent(link.body.deepLink.split("?text=")[1]);
    expect(decoded).toContain("2x Product WA-SKU-3");

    // Tenant isolation - a different seller cannot list or recover another store's abandoned carts.
    const other = await signupLoginAndCreateStore("wa-cart-other@example.com", "wa-cart-other-store");
    const crossList = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/carts/abandoned`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(crossList.status).toBe(200);
    expect(crossList.body).toEqual([]);
    const crossLink = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/carts/${stored.id}/recovery-link`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(crossLink.status).toBe(404);
    expect(sellerId).toBeTruthy();
  });

  it("Phase 4 close-out: the cart-recovery template is seller-editable per store, and an edit is reflected in the next generated recovery link", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("wa-template@example.com", "wa-template-store");
    const hostname = "wa-template-store.uzeyn.com";
    const { productId, variantId } = await createProductWithVariant(token, storeId, "WA-SKU-5");

    const initial = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/settings/cart-recovery-template`)
      .set("Authorization", `Bearer ${token}`);
    expect(initial.status).toBe(200);
    expect(initial.body.template).toContain("{{item_summary}}");

    const update = await request(app.getHttpServer())
      .put(`/stores/${storeId}/whatsapp/settings/cart-recovery-template`)
      .set("Authorization", `Bearer ${token}`)
      .send({ template: "Come back! {{item_summary}} is waiting at {{store_name}} - {{store_link}}" });
    expect(update.status).toBe(200);
    expect(update.body.template).toBe("Come back! {{item_summary}} is waiting at {{store_name}} - {{store_link}}");

    const reread = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/settings/cart-recovery-template`)
      .set("Authorization", `Bearer ${token}`);
    expect(reread.body.template).toBe("Come back! {{item_summary}} is waiting at {{store_name}} - {{store_link}}");

    const cartCreate = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "template-buyer@example.com", buyerWhatsapp: "03005556666", items: [{ productId, variantId, quantity: 1 }] });
    const stored = await superuser.cart.findUniqueOrThrow({ where: { sessionToken: cartCreate.body.sessionToken } });
    await superuser.cart.update({ where: { id: stored.id }, data: { status: "abandoned" } });

    const link = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/carts/${stored.id}/recovery-link`)
      .set("Authorization", `Bearer ${token}`);
    const decoded = decodeURIComponent(link.body.deepLink.split("?text=")[1]);
    expect(decoded).toContain("Come back!");
    expect(decoded).toContain("is waiting at");

    // Tenant isolation - a different seller can't read or write this store's template.
    const other = await signupLoginAndCreateStore("wa-template-other@example.com", "wa-template-other-store");
    const crossRead = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/settings/cart-recovery-template`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(crossRead.status).toBe(404);
    const crossWrite = await request(app.getHttpServer())
      .put(`/stores/${storeId}/whatsapp/settings/cart-recovery-template`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ template: "Malicious override" });
    expect(crossWrite.status).toBe(404);

    // The other seller's OWN store still has the untouched default - proves the write above was correctly store-scoped, not global.
    const otherDefault = await request(app.getHttpServer())
      .get(`/stores/${other.storeId}/whatsapp/settings/cart-recovery-template`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(otherDefault.body.template).toContain("{{item_summary}}");
  });

  it("a cart still shows in the abandoned list with hasWhatsapp: false when no number was captured, and its recovery link 400s", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("wa-cart-nonumber@example.com", "wa-cart-nonumber-store");
    const hostname = "wa-cart-nonumber-store.uzeyn.com";
    const { productId, variantId } = await createProductWithVariant(token, storeId, "WA-SKU-4");

    const cartCreate = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "no-number@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const stored = await superuser.cart.findUniqueOrThrow({ where: { sessionToken: cartCreate.body.sessionToken } });
    await superuser.cart.update({ where: { id: stored.id }, data: { status: "abandoned" } });

    const list = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/carts/abandoned`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.body[0].hasWhatsapp).toBe(false);

    const link = await request(app.getHttpServer())
      .get(`/stores/${storeId}/whatsapp/carts/${stored.id}/recovery-link`)
      .set("Authorization", `Bearer ${token}`);
    expect(link.status).toBe(400);
  });
});
