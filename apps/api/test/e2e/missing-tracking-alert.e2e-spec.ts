import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { EmailService } from "../../src/notifications/email.service";
import { MissingTrackingAlertService } from "../../src/orders/missing-tracking-alert.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Phase 5a (founder-requested "missing tracking" alert) - reuses
 * orderBucketWhereClause("awaitingTracking") from module27-orders-command-
 * center, so an order only gets flagged here if it's still in the exact
 * bucket a seller would see as "awaiting tracking" on the Orders page.
 */
describe("Missing-tracking alert sweep (e2e) - Phase 5a", () => {
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
    jest.clearAllMocks();
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
    await superuser.seller.update({ where: { userId: user.id }, data: { isTrusted: true, cnicHash: `test-cnic-hash-${user.id}` } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, sellerId: (await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } })).id as string, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  async function placeSelfFulfilledOrder(token: string, storeId: string, hostname: string) {
    const product = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Tracking Widget", status: "active" });
    const variant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${product.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price: 1000, stockQuantity: 100 });
    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId: product.body.id, variantId: variant.body.id, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    return { orderId: checkout.body.id as string };
  }

  /** Confirms the order and backdates its confirmed-transition so it reads as `hoursAgo` overdue. */
  async function confirmAndBackdate(token: string, storeId: string, orderId: string, hoursAgo: number) {
    await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);
    const backdated = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    await superuser.order.update({ where: { id: orderId }, data: { placedAt: backdated } });
    await superuser.orderTimelineEvent.updateMany({
      where: { orderId, eventType: "status_changed", afterValue: { equals: { status: "confirmed" } } },
      data: { createdAt: backdated },
    });
  }

  async function createSupplierWithListing(storeSlug: string, storeId: string, sellerToken: string) {
    const supplierEmail = `supplier-${Date.now()}-${Math.random()}@example.com`;
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email: supplierEmail, password: PASSWORD, businessName: "Supplier Co", role: "supplier" });
    const supplierLogin = await request(app.getHttpServer()).post("/auth/login").send({ email: supplierEmail, password: PASSWORD });
    const supplierToken = supplierLogin.body.accessToken as string;
    const supplierUser = await superuser.user.findUniqueOrThrow({ where: { email: supplierEmail }, include: { supplier: true } });

    const listing = await superuser.supplierListing.create({
      data: {
        supplierId: supplierUser.supplier!.id,
        adapterType: "printify",
        externalProductId: `ext-${Date.now()}-${Math.random()}`,
        title: "Supplier Mug",
        price: 500,
        shippingCost: 100,
        stockQuantity: 999,
        estimatedDeliveryMinDays: 5,
        estimatedDeliveryMaxDays: 10,
        supportedCountries: ["PK"],
        rawPayload: {},
      },
    });
    const link = await request(app.getHttpServer()).post("/supplier/store-links").set("Authorization", `Bearer ${supplierToken}`).send({ storeSlug });
    await request(app.getHttpServer()).patch(`/stores/${storeId}/supplier-links/${link.body.id}/approve`).set("Authorization", `Bearer ${sellerToken}`);
    const submit = await request(app.getHttpServer())
      .post("/supplier/listings/submit-review")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ storeSupplierLinkId: link.body.id, supplierListingId: listing.id });
    await request(app.getHttpServer()).patch(`/stores/${storeId}/listing-reviews/${submit.body.id}/approve`).set("Authorization", `Bearer ${sellerToken}`);

    const product = await superuser.product.findFirstOrThrow({ where: { title: "Supplier Mug" } });
    const variant = await superuser.productVariant.findFirstOrThrow({ where: { productId: product.id } });
    return { supplierEmail, productId: product.id as string, variantId: variant.id as string };
  }

  it("flags an overdue self-fulfilled order, emails the seller once, and sets missingTrackingAlertedAt", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("mta-seller@example.com", "mta-seller-store");
    const { orderId } = await placeSelfFulfilledOrder(token, storeId, hostname);
    await confirmAndBackdate(token, storeId, orderId, 25);

    const sellerEmailSpy = jest.spyOn(app.get(EmailService), "sendMissingTrackingAlertToSellerEmail");
    const supplierEmailSpy = jest.spyOn(app.get(EmailService), "sendMissingTrackingAlertToSupplierEmail");
    const sweep = app.get(MissingTrackingAlertService);

    const result = await sweep.runSweep();
    expect(result.checked).toBe(1);
    expect(result.alerted).toBe(1);
    expect(sellerEmailSpy).toHaveBeenCalledTimes(1);
    expect(supplierEmailSpy).not.toHaveBeenCalled();

    const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.missingTrackingAlertedAt).not.toBeNull();
  });

  it("does not re-alert an already-flagged order on a later sweep", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("mta-dedup@example.com", "mta-dedup-store");
    const { orderId } = await placeSelfFulfilledOrder(token, storeId, hostname);
    await confirmAndBackdate(token, storeId, orderId, 25);

    const sellerEmailSpy = jest.spyOn(app.get(EmailService), "sendMissingTrackingAlertToSellerEmail");
    const sweep = app.get(MissingTrackingAlertService);

    const first = await sweep.runSweep();
    expect(first.alerted).toBe(1);
    const second = await sweep.runSweep();
    expect(second.checked).toBe(0);
    expect(second.alerted).toBe(0);
    expect(sellerEmailSpy).toHaveBeenCalledTimes(1);
  });

  it("does not flag an order that has not yet crossed the alert-hours threshold", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("mta-fresh@example.com", "mta-fresh-store");
    const { orderId } = await placeSelfFulfilledOrder(token, storeId, hostname);
    // Confirmed just now - well under the default 24-hour threshold.
    await request(app.getHttpServer()).post(`/stores/${storeId}/orders/${orderId}/mark-as-paid`).set("Authorization", `Bearer ${token}`);

    const sweep = app.get(MissingTrackingAlertService);
    const result = await sweep.runSweep();
    expect(result.checked).toBe(0);
    expect(result.alerted).toBe(0);

    const order = await superuser.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.missingTrackingAlertedAt).toBeNull();
  });

  it("alerts the fulfilling supplier (not the seller) for a fully supplier-fulfilled order", async () => {
    const { token, sellerId: _sellerId, storeId, hostname } = await signupLoginAndCreateStore("mta-supplier@example.com", "mta-supplier-store");
    const { productId, variantId } = await createSupplierWithListing("mta-supplier-store", storeId, token);

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({ hostname, buyerEmail: "buyer@example.com", items: [{ productId, variantId, quantity: 1 }] });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const orderId = checkout.body.id as string;
    await confirmAndBackdate(token, storeId, orderId, 25);

    const sellerEmailSpy = jest.spyOn(app.get(EmailService), "sendMissingTrackingAlertToSellerEmail");
    const supplierEmailSpy = jest.spyOn(app.get(EmailService), "sendMissingTrackingAlertToSupplierEmail");
    const sweep = app.get(MissingTrackingAlertService);

    const result = await sweep.runSweep();
    expect(result.alerted).toBe(1);
    expect(supplierEmailSpy).toHaveBeenCalledTimes(1);
    expect(sellerEmailSpy).not.toHaveBeenCalled();
  });

  it("alerts BOTH the seller and the supplier for a mixed order (one self-fulfilled item + one supplier item)", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("mta-mixed@example.com", "mta-mixed-store");
    const { productId: supplierProductId, variantId: supplierVariantId } = await createSupplierWithListing("mta-mixed-store", storeId, token);

    const selfProduct = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Self-fulfilled Widget", status: "active" });
    const selfVariant = await request(app.getHttpServer())
      .post(`/stores/${storeId}/products/${selfProduct.body.id}/variants`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: `SKU-${Date.now()}-${Math.random()}`, price: 1000, stockQuantity: 100 });

    const cart = await request(app.getHttpServer())
      .post("/storefront/cart")
      .send({
        hostname,
        buyerEmail: "buyer@example.com",
        items: [
          { productId: selfProduct.body.id, variantId: selfVariant.body.id, quantity: 1 },
          { productId: supplierProductId, variantId: supplierVariantId, quantity: 1 },
        ],
      });
    const checkout = await request(app.getHttpServer())
      .post("/storefront/checkout")
      .send({ hostname, sessionToken: cart.body.sessionToken, shippingAddress });
    const orderId = checkout.body.id as string;
    await confirmAndBackdate(token, storeId, orderId, 25);

    const sellerEmailSpy = jest.spyOn(app.get(EmailService), "sendMissingTrackingAlertToSellerEmail");
    const supplierEmailSpy = jest.spyOn(app.get(EmailService), "sendMissingTrackingAlertToSupplierEmail");
    const sweep = app.get(MissingTrackingAlertService);

    const result = await sweep.runSweep();
    expect(result.alerted).toBe(1);
    expect(sellerEmailSpy).toHaveBeenCalledTimes(1);
    expect(supplierEmailSpy).toHaveBeenCalledTimes(1);
  });
});
