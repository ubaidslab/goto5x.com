import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { DataExportService } from "../../src/data-export/data-export.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";

/**
 * Module 56 (SRS §5.63, §14.62) - One-Click Full Export, Pro Gate. No new
 * export engine (FR-63.1) - this only proves the Pro-tier gate FR-63.2 adds
 * in front of Module 24's existing requestOnDemandExport() path: a sub-Pro
 * seller gets a clear upgrade prompt (never a partial/degraded export), a
 * Pro seller proceeds exactly as before subject to the existing cooldown,
 * and the unrelated subscription-renewal export trigger is untouched.
 */
describe("One-Click Full Export, Pro Gate (e2e) - SRS §5.63, §14.62", () => {
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
    await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, sellerId: seller.id as string };
  }

  async function upgradeToPro(sellerId: string) {
    const proPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 3 } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: proPlan.id } });
  }

  it("FR-63.2: a sub-Pro seller's on-demand export request is rejected with a clear upgrade prompt, never a partial export", async () => {
    const { token } = await signupLoginAndCreateStore("export-gate-free@example.com", "export-gate-free-store");

    const attempt = await request(app.getHttpServer()).post("/sellers/me/data-export").set("Authorization", `Bearer ${token}`);
    expect(attempt.status).toBe(403);
    expect(attempt.body.message.message).toMatch(/Pro-plan feature/i);

    // No row was created at all - not a degraded/partial export.
    const rows = await superuser.sellerDataExport.count();
    expect(rows).toBe(0);
  });

  it("FR-63.1/63.2: a Pro-tier seller's request proceeds exactly as Module 24's existing export already works, subject to the existing cooldown", async () => {
    const { token, sellerId } = await signupLoginAndCreateStore("export-gate-pro@example.com", "export-gate-pro-store");
    await upgradeToPro(sellerId);

    const first = await request(app.getHttpServer()).post("/sellers/me/data-export").set("Authorization", `Bearer ${token}`);
    expect(first.status).toBe(201);
    const rows = await superuser.sellerDataExport.count({ where: { sellerId } });
    expect(rows).toBe(1);

    // The pre-existing cooldown (FR-36.1) still applies on top of the gate -
    // this FR adds a check in front of it, it doesn't replace it.
    const second = await request(app.getHttpServer()).post("/sellers/me/data-export").set("Authorization", `Bearer ${token}`);
    expect(second.status).toBe(400);
    expect(second.body.message.message).toMatch(/every \d+ hour/i);
  });

  it("FR-63.2: the subscription-renewal export trigger is a different path and is never gated by the Pro-tier check", async () => {
    const { sellerId } = await signupLoginAndCreateStore("export-gate-renewal@example.com", "export-gate-renewal-store");
    // Still on the default entry plan (sub-Pro) - the on-demand path above would reject this seller.
    const subscription = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    const plan = await superuser.plan.findUniqueOrThrow({ where: { id: subscription.planId } });
    expect(plan.tierOrder).toBeLessThan(3);

    await app.get(DataExportService).triggerRenewalExport(sellerId);

    const rows = await superuser.sellerDataExport.findMany({ where: { sellerId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].trigger).toBe("subscription_renewal");
  });
});
