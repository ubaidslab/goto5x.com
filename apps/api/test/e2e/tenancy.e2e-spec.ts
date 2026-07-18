import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

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
