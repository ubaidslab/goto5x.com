import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Templates module (v0.31 design phase) - the "Managed by UZEYN" mark.
 * Founder-mandated invariant: mandatory on Free (the platform's own free
 * organic marketing), removable only once a paid plan grants the
 * capability (branding.powered_by_removable, plan-scoped) - and a stored
 * "hidden" preference (branding.powered_by_hidden, store-scoped) never
 * takes effect on its own, only when the plan capability also allows it.
 */
describe("Storefront branding - 'Managed by UZEYN' mark (e2e)", () => {
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
    const storeRow = await superuser.store.findUniqueOrThrow({ where: { id: store.body.id } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId, hostname: `${slug}.uzeyn.com` };
  }

  async function movePlan(sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: plan.id } });
  }

  it("is mandatory on the Free plan - a Free seller cannot hide it, and it always renders on the storefront", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("branding-free@example.com", "branding-free-store");

    const before = await request(app.getHttpServer()).get(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`);
    expect(before.body).toEqual({ removable: false, hidden: false, visible: true });

    const attempt = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/branding`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hidden: true });
    expect(attempt.status).toBe(403);

    const store = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(store.body.poweredByVisible).toBe(true);
  });

  it("a paid-plan seller can hide the mark, and it actually disappears from the live storefront", async () => {
    const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("branding-paid@example.com", "branding-paid-store");
    await movePlan(sellerId, 1); // Starter (paid)

    const before = await request(app.getHttpServer()).get(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`);
    expect(before.body).toEqual({ removable: true, hidden: false, visible: true });

    const update = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/branding`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hidden: true });
    expect(update.status).toBe(200);
    expect(update.body).toEqual({ removable: true, hidden: true, visible: false });

    const store = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(store.body.poweredByVisible).toBe(false);
  });

  it("downgrading back to Free reverts the mark to shown, even though the stored 'hidden' preference is untouched", async () => {
    const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("branding-downgrade@example.com", "branding-downgrade-store");
    await movePlan(sellerId, 1); // Starter (paid)
    await request(app.getHttpServer()).patch(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`).send({ hidden: true });
    const hiddenWhilePaid = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(hiddenWhilePaid.body.poweredByVisible).toBe(false);

    await movePlan(sellerId, 0); // back to Free

    const afterDowngrade = await request(app.getHttpServer()).get(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`);
    expect(afterDowngrade.body).toEqual({ removable: false, hidden: true, visible: true });

    const store = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(store.body.poweredByVisible).toBe(true);
  });

  it("seller A cannot read or write seller B's branding preference", async () => {
    const a = await signupLoginAndCreateStore("branding-tenant-a@example.com", "branding-tenant-a-store");
    const b = await signupLoginAndCreateStore("branding-tenant-b@example.com", "branding-tenant-b-store");
    await movePlan(a.sellerId, 1);

    const crossRead = await request(app.getHttpServer()).get(`/stores/${a.storeId}/branding`).set("Authorization", `Bearer ${b.token}`);
    expect(crossRead.status).toBe(404);

    const crossWrite = await request(app.getHttpServer())
      .patch(`/stores/${a.storeId}/branding`)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ hidden: true });
    expect(crossWrite.status).toBe(404);

    const unchanged = await request(app.getHttpServer()).get(`/stores/${a.storeId}/branding`).set("Authorization", `Bearer ${a.token}`);
    expect(unchanged.body.hidden).toBe(false);
  });
});
