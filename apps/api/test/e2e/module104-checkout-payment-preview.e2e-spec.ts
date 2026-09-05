import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * FR-6.70 (Module 104) - the checkout page's pre-order "how you'll pay"
 * preview. Extends FR-6.14 (Module 11): the exact same buyer-safe fields
 * OrderStatusLookupService already exposes post-order, now also reachable
 * before an order exists at all.
 */
describe("Pre-order payment-instructions preview (e2e) - SRS §5.6/§14.72 (Module 104, FR-6.70)", () => {
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
    return { token, storeId: store.body.id as string, hostname: `${slug}.uzeyn.com` };
  }

  it("returns the store's configured payment methods to an anonymous caller, before any order exists", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("checkout-preview-basic@example.com", "checkout-preview-basic");

    const update = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/payment-instructions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        bankAccountTitle: "Preview Store",
        bankAccountNumber: "PK00BANK0000000000000001",
        bankName: "Test Bank",
        jazzcashNumber: "03001234567",
        jazzcashAccountTitle: "Preview Store",
        nameDeclaredSelfOwned: true,
        codEnabled: true,
      });
    expect(update.status).toBe(200);

    // No Authorization header at all - this is the anonymous checkout page's own fetch.
    const res = await request(app.getHttpServer()).get("/storefront/payment-instructions").query({ hostname });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      bankAccountTitle: "Preview Store",
      bankAccountNumber: "PK00BANK0000000000000001",
      bankName: "Test Bank",
      jazzcashNumber: "03001234567",
      easypaisaNumber: null,
      codEnabled: true,
    });
  });

  it("returns the v1.0 defaults (every method null/false) for a store that hasn't configured any payment method yet", async () => {
    const { hostname } = await signupLoginAndCreateStore("checkout-preview-defaults@example.com", "checkout-preview-defaults");

    const res = await request(app.getHttpServer()).get("/storefront/payment-instructions").query({ hostname });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      bankAccountTitle: null,
      bankAccountNumber: null,
      bankName: null,
      jazzcashNumber: null,
      easypaisaNumber: null,
      codEnabled: false,
    });
  });

  it("404s for a hostname with no matching store", async () => {
    const res = await request(app.getHttpServer()).get("/storefront/payment-instructions").query({ hostname: "does-not-exist.uzeyn.com" });
    expect(res.status).toBe(404);
  });

  it("never leaks store A's payment instructions under store B's hostname", async () => {
    const a = await signupLoginAndCreateStore("checkout-preview-a@example.com", "checkout-preview-a");
    const b = await signupLoginAndCreateStore("checkout-preview-b@example.com", "checkout-preview-b");

    await request(app.getHttpServer())
      .patch(`/stores/${a.storeId}/payment-instructions`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ easypaisaNumber: "03111234567", easypaisaAccountTitle: "Store A", nameDeclaredSelfOwned: true });

    const bRes = await request(app.getHttpServer()).get("/storefront/payment-instructions").query({ hostname: b.hostname });
    expect(bRes.status).toBe(200);
    expect(bRes.body.easypaisaNumber).toBeNull();

    const aRes = await request(app.getHttpServer()).get("/storefront/payment-instructions").query({ hostname: a.hostname });
    expect(aRes.body.easypaisaNumber).toBe("03111234567");
  });
});
