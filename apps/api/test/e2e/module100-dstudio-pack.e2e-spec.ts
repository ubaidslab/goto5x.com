import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * FR-8.21 (Module 100, founder batch B18) - D-Studio Pack: a seller-
 * purchasable, time-boxed full-catalog unlock stacked orthogonally on top
 * of the existing GO/RUN/RISE/FLY tier ladder (FR-7.23), not a replacement
 * of it. "team" is a RISE-tier-floor section (section-catalog.ts) - same
 * probe theme-engine.e2e-spec.ts's own D-Studio grant tests already use.
 */
describe("D-Studio Pack (e2e) - FR-8.21 (Module 100, founder batch B18)", () => {
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
    return { token, storeId: store.body.id as string };
  }

  async function sellerIdFor(email: string) {
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return seller.id;
  }

  async function upgradeToTier(sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: plan.id } });
  }

  async function fullyVerifiedAdminToken(email: string): Promise<string> {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  const riseOnlySections = { settings: { sections: [{ id: "team", visible: true }] } };

  it("a GO-tier seller can request a Pack purchase and gets pending status + payment instructions", async () => {
    const { token } = await signupLoginAndCreateStore("dpack-go@example.com", "dpack-go-store");
    const res = await request(app.getHttpServer()).post("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(201);
    expect(Number(res.body.request.amount)).toBe(1499);
    expect(res.body.request.status).toBe("pending");
    expect(res.body.instructions).toBeTruthy();
  });

  it("a RISE-tier seller (already has the full catalog for free) is rejected - no marginal benefit to sell", async () => {
    const { token } = await signupLoginAndCreateStore("dpack-rise@example.com", "dpack-rise-store");
    const sellerId = await sellerIdFor("dpack-rise@example.com");
    await upgradeToTier(sellerId, 2);
    const res = await request(app.getHttpServer()).post("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it("a second request while one is already pending is rejected", async () => {
    const { token } = await signupLoginAndCreateStore("dpack-dup@example.com", "dpack-dup-store");
    await request(app.getHttpServer()).post("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${token}`).send({});
    const duplicate = await request(app.getHttpServer()).post("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${token}`).send({});
    expect(duplicate.status).toBe(400);
  });

  it("full flow: request -> admin verify -> a GO-tier seller can now save a RISE-only section, with a ~90-day expiry", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("dpack-happy@example.com", "dpack-happy-store");
    const sellerId = await sellerIdFor("dpack-happy@example.com");

    // Before purchase: a RISE-only section is rejected.
    const before = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send(riseOnlySections);
    expect(before.status).toBe(403);

    const purchaseReq = await request(app.getHttpServer()).post("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${token}`).send({});
    expect(purchaseReq.status).toBe(201);

    const adminToken = await fullyVerifiedAdminToken("dpack-happy-admin@example.com");
    const pending = await request(app.getHttpServer()).get("/admin/dstudio-pack-purchases").set("Authorization", `Bearer ${adminToken}`);
    expect(pending.status).toBe(200);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].seller.id).toBe(sellerId);

    const beforeVerify = new Date();
    const verify = await request(app.getHttpServer())
      .post(`/admin/dstudio-pack-purchases/${purchaseReq.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(verify.status).toBe(201);
    expect(verify.body.request.status).toBe("verified");

    // The grant is a real, time-limited Settings Registry override - not a
    // permanent one, and set to RISE (2), not FLY (3).
    const grantRow = await superuser.settingsValue.findFirst({
      where: { definitionKey: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerId },
    });
    expect(grantRow?.value).toBe(2);
    expect(grantRow?.expiresAt).not.toBeNull();
    const daysUntilExpiry = (grantRow!.expiresAt!.getTime() - beforeVerify.getTime()) / DAY_MS;
    expect(daysUntilExpiry).toBeCloseTo(90, 0);

    // Now the same GO-tier seller can save the RISE-only section.
    const after = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send(riseOnlySections);
    expect(after.status).toBe(200);
  });

  it("an admin can reject a Pack purchase, leaving no grant behind", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("dpack-reject@example.com", "dpack-reject-store");
    const sellerId = await sellerIdFor("dpack-reject@example.com");
    const purchaseReq = await request(app.getHttpServer()).post("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${token}`).send({});

    const adminToken = await fullyVerifiedAdminToken("dpack-reject-admin@example.com");
    const reject = await request(app.getHttpServer())
      .post(`/admin/dstudio-pack-purchases/${purchaseReq.body.request.id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(reject.status).toBe(201);
    expect(reject.body.status).toBe("rejected");

    const grantRow = await superuser.settingsValue.findFirst({
      where: { definitionKey: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerId },
    });
    expect(grantRow).toBeNull();

    const stillLocked = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send(riseOnlySections);
    expect(stillLocked.status).toBe(403);
  });

  it("on natural expiry, access falls back to the seller's real (GO) tier - no lockout, just a reverted ceiling", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("dpack-expiry@example.com", "dpack-expiry-store");
    const sellerId = await sellerIdFor("dpack-expiry@example.com");
    const purchaseReq = await request(app.getHttpServer()).post("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${token}`).send({});
    const adminToken = await fullyVerifiedAdminToken("dpack-expiry-admin@example.com");
    await request(app.getHttpServer())
      .post(`/admin/dstudio-pack-purchases/${purchaseReq.body.request.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);

    const grantedOk = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send(riseOnlySections);
    expect(grantedOk.status).toBe(200);

    // Age the grant row past expiry directly, same technique
    // theme-engine.e2e-spec.ts's own D-Studio grant expiry test uses. The
    // `grantedOk` request just above already populated SettingsService's
    // 60s read cache with the still-valid value (settings.service.ts's own
    // documented, deliberate staleness bound - the admin-only /resolve
    // endpoint reads live and skips this cache entirely, but the real
    // enforcement hot path used here does not) - flush it the same way
    // every other test's afterEach does, so this assertion reflects the
    // row's new state rather than a stale cache entry within its TTL.
    await superuser.settingsValue.updateMany({
      where: { definitionKey: "dstudio.tier_override_order", scopeType: "seller", scopeId: sellerId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await resetRedis();

    const afterExpiry = await request(app.getHttpServer())
      .patch(`/stores/${storeId}/theme-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ settings: { sections: [{ id: "team", visible: true }, { id: "hero", visible: true }] } });
    expect(afterExpiry.status).toBe(403);
  });

  it("RLS tenant isolation: a seller's own purchase-request list never shows another seller's requests", async () => {
    const a = await signupLoginAndCreateStore("dpack-tenant-a@example.com", "dpack-tenant-a-store");
    const b = await signupLoginAndCreateStore("dpack-tenant-b@example.com", "dpack-tenant-b-store");
    await request(app.getHttpServer()).post("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${a.token}`).send({});

    const bList = await request(app.getHttpServer()).get("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${b.token}`);
    expect(bList.body).toHaveLength(0);

    const aList = await request(app.getHttpServer()).get("/sellers/me/dstudio-pack-purchases").set("Authorization", `Bearer ${a.token}`);
    expect(aList.body).toHaveLength(1);
  });
});
