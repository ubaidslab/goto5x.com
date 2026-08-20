import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 77 (SRS §5.6j/FR-6.53) - Verification-Channel Pricing. Email
 * verification stays free on every tier, always; WhatsApp verification
 * becomes plan-gated (free from RUN upward, same boundary Module 76 gave
 * prepaid_partial_advance). SMS does not exist as a channel and is
 * explicitly out of scope.
 */
describe("Verification-Channel Pricing (e2e) - SRS §5.6j, §14.67, FR-6.53", () => {
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
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { isTrusted: true } });
    await superuser.storePaymentInstructions.update({ where: { storeId: store.body.id }, data: { codEnabled: true } });
    await superuser.seller.update({ where: { id: storeRow.sellerId }, data: { cnicHash: `test-cnic-hash-${storeRow.sellerId}` } });
    await superuser.store.update({ where: { id: store.body.id }, data: { publishedAt: new Date() } });
    return { token, storeId: store.body.id as string, sellerId: storeRow.sellerId as string };
  }

  async function upgradeToTier(sellerId: string, tierOrder: number) {
    const plan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: plan.id } });
  }

  async function setChannel(token: string, storeId: string, channel: string) {
    return request(app.getHttpServer())
      .patch(`/stores/${storeId}/verification-settings`)
      .set("Authorization", `Bearer ${token}`)
      .send({ channel });
  }

  it("email verification is free on GO - never gated", async () => {
    const { token, storeId } = await signupLoginAndCreateStore("vcp-email-free@example.com", "vcp-email-free-store");
    const res = await setChannel(token, storeId, "email_otp");
    expect(res.status).toBe(200);
    expect(res.body.channel).toBe("email_otp");
  });

  it("a GO seller is blocked from selecting WhatsApp verification; a RUN seller is not", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreateStore("vcp-whatsapp-gate@example.com", "vcp-whatsapp-gate-store");

    const blocked = await setChannel(token, storeId, "whatsapp_otp");
    expect(blocked.status).toBe(403);
    expect(blocked.body.message.message).toMatch(/plan/i);

    await upgradeToTier(sellerId, 1); // RUN
    const allowed = await setChannel(token, storeId, "whatsapp_otp");
    expect(allowed.status).toBe(200);
    expect(allowed.body.channel).toBe("whatsapp_otp");
  });

  it("a store already using WhatsApp verification keeps working uninterrupted even if the seller is on GO (gate applies at selection time, not retroactively)", async () => {
    const { token, storeId, sellerId } = await signupLoginAndCreateStore("vcp-grandfathered@example.com", "vcp-grandfathered-store");
    await upgradeToTier(sellerId, 1);
    const set = await setChannel(token, storeId, "whatsapp_otp");
    expect(set.status).toBe(200);

    // Downgrade back to GO after the channel is already configured.
    const goPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: goPlan.id } });

    const stillReadable = await request(app.getHttpServer())
      .get(`/stores/${storeId}/verification-settings`)
      .set("Authorization", `Bearer ${token}`);
    expect(stillReadable.status).toBe(200);
    expect(stillReadable.body.channel).toBe("whatsapp_otp");
  });
});
