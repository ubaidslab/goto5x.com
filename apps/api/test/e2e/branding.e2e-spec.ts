import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Templates module (v0.31 design phase) - the "Managed by UZEYN" mark.
 * Founder-mandated invariant: mandatory on First Month/Starter/Growth (the
 * platform's own free organic marketing), removable only once the seller
 * reaches Pro (branding.powered_by_removable, plan-scoped, v0.33 - see SRS
 * "Plans & Pricing") - and a stored "hidden" preference
 * (branding.powered_by_hidden, store-scoped) never takes effect on its
 * own, only when the plan capability also allows it.
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

  async function moveToTeamPlan(sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "team", tierOrder } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: plan.id } });
  }

  it("is mandatory on First Month (signup default) - the seller cannot hide it, and it always renders on the storefront", async () => {
    const { token, storeId, hostname } = await signupLoginAndCreateStore("branding-entry@example.com", "branding-entry-store");

    const before = await request(app.getHttpServer()).get(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`);
    expect(before.body).toEqual({ removable: false, hidden: false, visible: true });

    const attempt = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/branding`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hidden: true });
    expect(attempt.status).toBe(403);

    const store = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(store.body.poweredByVisible).toBe(true);
    // FR-74.3 (§5.74) - the new loading-screen gate; mandatory for every
    // non-RISE individual tier same as poweredByVisible above.
    expect(store.body.loadingScreenBrandingVisible).toBe(true);
  });

  it("is still mandatory on Starter and Growth - only Pro grants removal (v0.33 SRS 'Plans & Pricing')", async () => {
    const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("branding-starter@example.com", "branding-starter-store");
    await movePlan(sellerId, 1); // Starter
    const starter = await request(app.getHttpServer()).get(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`);
    expect(starter.body.removable).toBe(false);

    await movePlan(sellerId, 2); // Growth
    const growth = await request(app.getHttpServer()).get(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`);
    expect(growth.body.removable).toBe(false);

    // The OLD mechanism (branding.powered_by_removable) above stays
    // FLY-only (tierOrder 3), unaffected by D76d. The NEW loading-screen
    // gate still shows true here too, but only because `hidden` was
    // never toggled on - see the dedicated RISE test below for proof
    // that tierOrder 2 now actually grants removability there.
    const store = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(store.body.loadingScreenBrandingVisible).toBe(true);
  });

  it("D76d (founder decision, 2026-10-10 - B4) - the NEW loading-screen gate becomes removable on RISE (tierOrder 2), superseding FR-74.3's original FLY-only boundary for the MVP window", async () => {
    const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("branding-rise@example.com", "branding-rise-store");
    await movePlan(sellerId, 2); // RISE

    // The OLD mechanism is untouched by D76d - still FLY-only, so RISE
    // still can't remove the original "Managed by UZEYN" mark.
    const branding = await request(app.getHttpServer()).get(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`);
    expect(branding.body.removable).toBe(false);

    await request(app.getHttpServer()).patch(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`).send({ hidden: true });

    const store = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(store.body.poweredByVisible).toBe(true); // OLD mark: still mandatory on RISE
    expect(store.body.loadingScreenBrandingVisible).toBe(false); // NEW gate: now removable on RISE
  });

  it("a FLY seller can still hide the OLD mark, but the NEW loading-screen gate no longer follows it there (D76d moved that boundary to RISE)", async () => {
    const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("branding-pro@example.com", "branding-pro-store");
    await movePlan(sellerId, 3); // FLY

    const before = await request(app.getHttpServer()).get(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`);
    expect(before.body).toEqual({ removable: true, hidden: false, visible: true });

    const update = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/branding`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hidden: true });
    expect(update.status).toBe(200);
    expect(update.body).toEqual({ removable: true, hidden: true, visible: false });

    const store = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(store.body.poweredByVisible).toBe(false); // OLD mark: still removable on FLY, unaffected by D76d
    // D76d (B4) - the NEW loading-screen gate moved its removable tier
    // from FLY to RISE; FLY itself is also dormant for the MVP window
    // (D75d), so this now stays mandatory here too.
    expect(store.body.loadingScreenBrandingVisible).toBe(true);
  });

  it("D76d/FR-74.3 (§5.74) - the new loading-screen gate is individual-RISE-only; Team Growth/Scale keep it mandatory even though the existing mark is removable for them", async () => {
    const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore(
      "branding-team-growth@example.com",
      "branding-team-growth-store",
    );
    await moveToTeamPlan(sellerId, 1); // Team Growth

    const branding = await request(app.getHttpServer()).get(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`);
    expect(branding.body.removable).toBe(true); // existing mechanism: unaffected, still extends to Team Growth

    await request(app.getHttpServer()).patch(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`).send({ hidden: true });

    const store = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(store.body.poweredByVisible).toBe(false); // existing "Managed by UZEYN" mark: unaffected by this section
    expect(store.body.loadingScreenBrandingVisible).toBe(true); // NEW gate never reaches Team tiers - stays mandatory
  });

  it("downgrading off Pro reverts the mark to shown, even though the stored 'hidden' preference is untouched", async () => {
    const { token, storeId, sellerId, hostname } = await signupLoginAndCreateStore("branding-downgrade@example.com", "branding-downgrade-store");
    await movePlan(sellerId, 3); // Pro
    await request(app.getHttpServer()).patch(`/stores/${storeId}/branding`).set("Authorization", `Bearer ${token}`).send({ hidden: true });
    const hiddenOnPro = await request(app.getHttpServer()).get(`/storefront/store?hostname=${hostname}`);
    expect(hiddenOnPro.body.poweredByVisible).toBe(false);

    await movePlan(sellerId, 1); // downgrade to Starter

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
