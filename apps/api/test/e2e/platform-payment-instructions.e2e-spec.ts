import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * v0.41 audit fix (SRS FR-6.23) - ManualBankTransferTopUpAdapter used to
 * return a hardcoded placeholder sentence ("...the platform's business
 * bank account...") with no real receiving-account details anywhere, and
 * there was no admin-configurable mechanism at all. This is now a real
 * Settings Registry key (`billing.platform_payment_instructions`),
 * admin-editable without a deploy, surfaced to a seller at the exact
 * point they see their plan-fee payment preview.
 */
describe("Platform payment instructions (e2e) - SRS FR-6.23, v0.41 audit fix", () => {
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

  async function signup(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    return login.body.accessToken as string;
  }

  async function createAndLoginAdmin(email: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  it("with nothing configured, a seller sees a clear 'not configured' message - never a fabricated bank account", async () => {
    const token = await signup("ppi-unconfigured@example.com");
    const preview = await request(app.getHttpServer())
      .get("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.instructions).toMatch(/haven't been configured yet/i);
    expect(preview.body.instructions).not.toMatch(/account number|iban|easypaisa:|jazzcash:/i);
  });

  it("an admin can configure real receiving-account details, and a seller then sees them verbatim on their plan-fee preview", async () => {
    const adminToken = await createAndLoginAdmin("ppi-admin1@example.com");
    const token = await signup("ppi-configured@example.com");

    const setValue = await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "billing.platform_payment_instructions",
        scopeType: "global",
        value: {
          bank: { enabled: true, accountTitle: "UZEYN Platform Ltd", accountNumber: "01234567890123", iban: "PK00ABCD0000001234567890", bankName: "Meezan Bank" },
          easypaisa: { enabled: false, accountTitle: "", number: "" },
          jazzcash: { enabled: false, accountTitle: "", number: "" },
        },
      });
    expect(setValue.status).toBe(200);

    const preview = await request(app.getHttpServer())
      .get("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.instructions).toContain("Meezan Bank");
    expect(preview.body.instructions).toContain("UZEYN Platform Ltd");
    expect(preview.body.instructions).toContain("01234567890123");
    expect(preview.body.instructions).toContain("PK00ABCD0000001234567890");
    // Disabled methods never appear.
    expect(preview.body.instructions).not.toMatch(/easypaisa|jazzcash/i);
  });

  it("a method left disabled is never shown even if its fields happen to be filled in", async () => {
    const adminToken = await createAndLoginAdmin("ppi-admin2@example.com");
    const token = await signup("ppi-disabled-method@example.com");

    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "billing.platform_payment_instructions",
        scopeType: "global",
        value: {
          bank: { enabled: false, accountTitle: "Should Not Appear", accountNumber: "999999", iban: "", bankName: "Hidden Bank" },
          easypaisa: { enabled: true, accountTitle: "UZEYN Platform", number: "03001234567" },
          jazzcash: { enabled: false, accountTitle: "", number: "" },
        },
      });

    const preview = await request(app.getHttpServer())
      .get("/sellers/me/wallet/plan-fee-payment")
      .set("Authorization", `Bearer ${token}`);
    expect(preview.body.instructions).toContain("03001234567");
    expect(preview.body.instructions).not.toMatch(/Hidden Bank|Should Not Appear|999999/);
  });

  it("the supplier top-up flow resolves the same platform payment instructions", async () => {
    const adminToken = await createAndLoginAdmin("ppi-admin3@example.com");

    await request(app.getHttpServer())
      .put("/admin/settings/values")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "billing.platform_payment_instructions",
        scopeType: "global",
        value: {
          bank: { enabled: true, accountTitle: "UZEYN Platform Ltd", accountNumber: "555555", iban: "", bankName: "Test Bank" },
          easypaisa: { enabled: false, accountTitle: "", number: "" },
          jazzcash: { enabled: false, accountTitle: "", number: "" },
        },
      });

    const supplierEmail = "ppi-supplier@example.com";
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ email: supplierEmail, password: PASSWORD, businessName: "PPI Test Supplier", role: "supplier" });
    const supplierLogin = await request(app.getHttpServer()).post("/auth/login").send({ email: supplierEmail, password: PASSWORD });
    const supplierToken = supplierLogin.body.accessToken as string;

    const topUp = await request(app.getHttpServer())
      .post("/suppliers/me/wallet/topup-requests")
      .set("Authorization", `Bearer ${supplierToken}`)
      .send({ amount: 1000 });
    expect(topUp.status).toBe(201);
    expect(topUp.body.instructions).toContain("Test Bank");
    expect(topUp.body.instructions).toContain("555555");
  });
});
