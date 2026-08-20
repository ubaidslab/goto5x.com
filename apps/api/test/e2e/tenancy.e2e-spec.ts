import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SettingsService } from "../../src/settings-registry/settings.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const ADMIN_ID = "00000000-0000-0000-0000-000000000000";

describe("Tenant isolation on stores (e2e) - SRS §3.2/§14.2/§14.12 release gate", () => {
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

  async function signupAndLogin(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    return login.body.accessToken as string;
  }

  it("seller A cannot read, list, or update seller B's store via the API (app-layer enforcement)", async () => {
    const tokenA = await signupAndLogin("tenantA@example.com");
    const tokenB = await signupAndLogin("tenantB@example.com");

    const createA = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Store A", slug: "store-a-e2e" });
    expect(createA.status).toBe(201);
    const storeAId = createA.body.id;

    // Owner can read their own store.
    const ownRead = await request(app.getHttpServer())
      .get(`/stores/${storeAId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(ownRead.status).toBe(200);

    // Seller B cannot read seller A's store.
    const crossRead = await request(app.getHttpServer())
      .get(`/stores/${storeAId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(crossRead.status).toBe(404);

    // Seller B cannot update seller A's store.
    const crossUpdate = await request(app.getHttpServer())
      .patch(`/stores/${storeAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked" });
    expect(crossUpdate.status).toBe(404);

    // Seller B's own store list never includes seller A's store.
    const listB = await request(app.getHttpServer()).get("/stores").set("Authorization", `Bearer ${tokenB}`);
    expect(listB.body.find((s: any) => s.id === storeAId)).toBeUndefined();

    const unchanged = await superuser.store.findUniqueOrThrow({ where: { id: storeAId } });
    expect(unchanged.name).toBe("Store A");
  });

  it("RLS denies cross-tenant access at the database level, independent of the application layer", async () => {
    const sellerA = await superuser.seller.create({
      data: { businessName: "DB-level A", user: { create: { email: "db-a@example.com", roleFlags: ["seller"] } } },
    });
    const sellerB = await superuser.seller.create({
      data: { businessName: "DB-level B", user: { create: { email: "db-b@example.com", roleFlags: ["seller"] } } },
    });
    await superuser.store.create({ data: { sellerId: sellerA.id, name: "DB Store A", slug: "db-store-a" } });
    await superuser.store.create({ data: { sellerId: sellerB.id, name: "DB Store B", slug: "db-store-b" } });

    const runtime = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

    const asSellerA = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_seller_id = '${sellerA.id}'`);
      return tx.store.findMany();
    });
    expect(asSellerA.map((s) => s.slug)).toEqual(["db-store-a"]);

    const noContext = await runtime.$transaction(async (tx) => {
      return tx.store.findMany();
    });
    expect(noContext).toEqual([]); // fail-closed: no session variable set -> zero rows, not an error and not "all rows"

    await runtime.$disconnect();
  });
});

describe("Multi-Store Per Seller (e2e) - SRS §5.56/FR-56.1/FR-56.2 (Module 49)", () => {
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

  async function signupAndLogin(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, sellerId: seller.id as string };
  }

  // Module 74 (v0.39) - looked up by tierOrder, never by name, so a
  // future tier rename (this one has already happened twice) never
  // requires touching this helper again.
  async function upgradeToMultiStoreTier(sellerId: string) {
    const higherPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 2 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: higherPlan.id } });
  }

  it("a GO seller (limit 1) is blocked from creating a second store with a clear message, and the block lifts immediately on upgrade to a higher tier", async () => {
    const { token, sellerId } = await signupAndLogin("multistore-limit@example.com");

    const first = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Store One", slug: "multistore-one" });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Store Two", slug: "multistore-two" });
    expect(second.status).toBe(400);
    expect(second.body.message.message).toMatch(/store limit \(1\) has been reached/i);

    await upgradeToMultiStoreTier(sellerId);
    // Module 75 (§5.6j/FR-7.23) raised RISE's real store limit to 5 - this
    // test's actual point is the upgrade MECHANISM (the block lifting
    // immediately), not RISE's specific business number, so a
    // seller-scoped override (highest precedence) keeps the limit small
    // and the test's third-store assertion below meaningful.
    await app.get(SettingsService).setValue("stores.max_per_seller", "seller", sellerId, 2, ADMIN_ID);

    const afterUpgrade = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Store Two", slug: "multistore-two" });
    expect(afterUpgrade.status).toBe(201);

    const third = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Store Three", slug: "multistore-three" });
    expect(third.status).toBe(400);
    expect(third.body.message.message).toMatch(/store limit \(2\) has been reached/i);
  });

  it("a seller who owns two stores cannot see or mutate one store's data from the other store's dashboard context (explicit cross-store assertion, not just relying on the RLS guarantee)", async () => {
    const { token, sellerId } = await signupAndLogin("multistore-isolation@example.com");
    await upgradeToMultiStoreTier(sellerId);

    const createFirst = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Isolation Store One", slug: "isolation-one" });
    const createSecond = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Isolation Store Two", slug: "isolation-two" });
    const storeOneId = createFirst.body.id;
    const storeTwoId = createSecond.body.id;

    const productInStoreOne = await request(app.getHttpServer())
      .post(`/stores/${storeOneId}/products`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Store One Only Product", description: "x", status: "draft" });
    expect(productInStoreOne.status).toBe(201);
    const productId = productInStoreOne.body.id;

    // The same seller's OWN second store must not see or be able to mutate
    // the first store's product - RLS (seller-scoped) alone would permit
    // this; the storeId === store.sellerId... check inside each service is
    // what has to catch it.
    const listInStoreTwo = await request(app.getHttpServer())
      .get(`/stores/${storeTwoId}/products`)
      .set("Authorization", `Bearer ${token}`);
    expect(listInStoreTwo.body.items ?? listInStoreTwo.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: productId })]),
    );

    const crossStoreRead = await request(app.getHttpServer())
      .get(`/stores/${storeTwoId}/products/${productId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(crossStoreRead.status).toBe(404);

    const crossStoreUpdate = await request(app.getHttpServer())
      .patch(`/stores/${storeTwoId}/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Hijacked from store two" });
    expect(crossStoreUpdate.status).toBe(404);

    const unchanged = await superuser.product.findUniqueOrThrow({ where: { id: productId } });
    expect(unchanged.title).toBe("Store One Only Product");
  });

  it("the store switcher lists exactly the seller's own stores via GET /stores", async () => {
    const { token, sellerId } = await signupAndLogin("multistore-switcher@example.com");
    await upgradeToMultiStoreTier(sellerId);

    await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${token}`).send({ name: "Switcher One", slug: "switcher-one" });
    await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${token}`).send({ name: "Switcher Two", slug: "switcher-two" });

    const list = await request(app.getHttpServer()).get("/stores").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.map((s: any) => s.slug).sort()).toEqual(["switcher-one", "switcher-two"]);
  });
});
