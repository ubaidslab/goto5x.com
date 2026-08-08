import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { encryptDriveToken } from "../../src/media/drive-token-crypto.util";
import { DRIVE_CLIENT, DRIVE_FILE_SCOPE, IDriveClient } from "../../src/media/google-drive/drive-client.interface";
import { DataExportService } from "../../src/data-export/data-export.service";
import { EmailService } from "../../src/notifications/email.service";
import { PlanFeeDebitService } from "../../src/billing/plan-fee-debit.service";
import { resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestS3Server, TestS3Server } from "./s3-test-server";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";

/**
 * Module 24 (SRS §5.36, FR-36.1-36.5, checklist §14.36) - Seller Data
 * Export. Overrides DRIVE_CLIENT with a fake for the same reason
 * google-drive.e2e-spec.ts does (no network egress to Google from this
 * sandbox) - everything else (CSV generation, PDF generation via a real
 * headless Chromium, the rate limit, the non-blocking-failure guarantee)
 * runs for real against the real app/Postgres/Redis/MinIO-fake.
 */
describe("Seller Data Export (e2e) - SRS §5.36, §14.36", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let s3: TestS3Server;
  let fakeDriveClient: jest.Mocked<IDriveClient>;

  beforeAll(async () => {
    s3 = await startTestS3Server(4569, "uzeyn-media-test");
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);

    fakeDriveClient = {
      getAuthUrl: jest.fn(),
      exchangeCodeForTokens: jest.fn(),
      refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: "fake-access-token", expiresInSeconds: 3600 }),
      listImportableFiles: jest.fn(),
      downloadFile: jest.fn(),
      revoke: jest.fn(),
      createFolder: jest.fn().mockResolvedValue("fake-export-folder-id"),
      uploadFile: jest.fn().mockResolvedValue("fake-drive-file-id"),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DRIVE_CLIENT)
      .useValue(fakeDriveClient)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
    await s3.close();
  });

  afterEach(async () => {
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    jest.clearAllMocks();
  });

  async function signup(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, userId: user.id as string, sellerId: seller.id as string };
  }

  async function createStore(email: string, slug: string) {
    const { token, sellerId } = await signup(email);
    const store = await request(app.getHttpServer())
      .post("/stores")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Store for ${email}`, slug });
    return { token, storeId: store.body.id as string, sellerId };
  }

  async function createAndLoginAdmin(email: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const user = await superuser.user.create({ data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() } });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password: ADMIN_PASSWORD });
    const enroll = await request(app.getHttpServer()).post("/admin/auth/mfa/enroll").send({ preAuthToken: login.body.preAuthToken });
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer()).post("/admin/auth/mfa/verify").send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  async function topUpAndVerify(token: string, adminToken: string, amount: number) {
    const req = await request(app.getHttpServer()).post("/sellers/me/wallet/topup-requests").set("Authorization", `Bearer ${token}`).send({ amount });
    await request(app.getHttpServer()).post(`/admin/wallet-topups/${req.body.request.id}/verify`).set("Authorization", `Bearer ${adminToken}`);
  }

  /** Forces a seller onto a paid plan due for renewal right now, with enough wallet balance to cover the fee. */
  async function makeDueForRenewal(email: string, token: string, sellerId: string, adminEmailSuffix: string) {
    const paidPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: { gt: 0 } } });
    await superuser.subscription.update({ where: { sellerId }, data: { planId: paidPlan.id, currentPeriodEnd: new Date() } });
    const adminToken = await createAndLoginAdmin(`admin-${adminEmailSuffix}@example.com`);
    await topUpAndVerify(token, adminToken, 100000);
  }

  async function seedOneOfEach(storeId: string) {
    const category = await superuser.category.create({ data: { name: "Export Test", slug: `export-${Date.now()}-${Math.random()}` } });
    await superuser.product.create({ data: { storeId, categoryId: category.id, title: "Export Product", status: "active" } });
    const existingOrderCount = await superuser.order.count({ where: { storeId } });
    await superuser.order.create({
      data: {
        storeId,
        orderNumber: existingOrderCount + 1,
        buyerEmail: "buyer@example.com",
        statusLookupToken: `tok-${storeId}-${Date.now()}`,
        shippingAddress: {},
        status: "confirmed",
        shippingAmount: 0,
        totalAmount: 500,
        currency: "PKR",
      },
    });
    await superuser.customer.create({ data: { storeId, email: "buyer@example.com", name: "Buyer" } });
  }

  async function connectDrive(sellerId: string, opts: { fileScope: boolean }) {
    const encryptionKey = Buffer.from(process.env.DRIVE_TOKEN_ENCRYPTION_KEY!, "base64");
    const refreshTokenEncrypted = encryptDriveToken("fake-refresh-token", encryptionKey);
    await superuser.googleDriveConnection.create({
      data: {
        sellerId,
        googleAccountEmail: "seller@example.com",
        refreshTokenEncrypted,
        grantedScopes: opts.fileScope
          ? ["https://www.googleapis.com/auth/drive.readonly", DRIVE_FILE_SCOPE]
          : ["https://www.googleapis.com/auth/drive.readonly"],
        status: "active",
      },
    });
  }

  it("a subscription renewal triggers an export containing the trailing-period products/orders/customers CSVs plus one summary PDF (FR-36.1/36.2)", async () => {
    const { token, storeId, sellerId } = await createStore("export-renewal@example.com", "export-renewal");
    await seedOneOfEach(storeId);
    await makeDueForRenewal("export-renewal@example.com", token, sellerId, "export-renewal");

    const planFeeDebit = app.get(PlanFeeDebitService);
    const dataExport = app.get(DataExportService);
    const sweep = await planFeeDebit.runMonthlyDebitSweep(new Date());
    expect(sweep.renewedSellerIds).toContain(sellerId);

    await dataExport.triggerRenewalExport(sellerId);
    const created = await superuser.sellerDataExport.findFirstOrThrow({ where: { sellerId }, orderBy: { createdAt: "desc" } });
    expect(created.trigger).toBe("subscription_renewal");
    await dataExport.processExport(created.id);

    const completed = await superuser.sellerDataExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(completed.status).toBe("completed");
    expect(completed.deliveryMethod).toBe("email"); // no Drive connection for this seller
    expect(completed.productsCsvKey).toBeTruthy();
    expect(completed.ordersCsvKey).toBeTruthy();
    expect(completed.customersCsvKey).toBeTruthy();
    expect(completed.summaryPdfKey).toBeTruthy();
    // v0.28 security fix - the stored value is an internal storage key
    // under the non-public prefix, never a URL.
    expect(completed.productsCsvKey).toMatch(/^private-exports\//);
    expect(completed.productsCsvKey).not.toMatch(/^https?:\/\//);

    const download = await request(app.getHttpServer())
      .get(`/sellers/me/data-export/${created.id}/download/products`)
      .set("Authorization", `Bearer ${token}`);
    expect(download.status).toBe(200);
    expect(download.text).toContain("Export Product");
  }, 30000);

  it("v0.28 security fix: the export list/history response never leaks a raw storage key or URL, only per-file availability flags (FR-36.3)", async () => {
    const { token, storeId, sellerId } = await createStore("export-no-leak@example.com", "export-no-leak");
    await seedOneOfEach(storeId);
    const dataExport = app.get(DataExportService);
    const run = await dataExport.requestOnDemandExport(sellerId);
    await dataExport.processExport(run.id);

    const list = await request(app.getHttpServer()).get("/sellers/me/data-export").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    const row = list.body.find((r: { id: string }) => r.id === run.id);
    expect(row).toBeTruthy();
    expect(row.status).toBe("completed");
    expect(row.hasProductsCsv).toBe(true);
    expect(row.hasOrdersCsv).toBe(true);
    expect(row.hasCustomersCsv).toBe(true);
    expect(row.hasSummaryPdf).toBe(true);
    // None of the raw keys, and nothing resembling a fetchable URL, ever
    // reaches the response body.
    const serialized = JSON.stringify(list.body);
    expect(serialized).not.toContain("private-exports");
    expect(serialized).not.toMatch(/https?:\/\//);
  });

  it("v0.28 security fix: the download endpoint requires authentication and rejects a seller that doesn't own the export (FR-36.3)", async () => {
    const { token, storeId, sellerId } = await createStore("export-owner@example.com", "export-owner");
    await seedOneOfEach(storeId);
    const dataExport = app.get(DataExportService);
    const run = await dataExport.requestOnDemandExport(sellerId);
    await dataExport.processExport(run.id);

    const noAuth = await request(app.getHttpServer()).get(`/sellers/me/data-export/${run.id}/download/products`);
    expect(noAuth.status).toBe(401);

    const { token: otherToken } = await createStore("export-intruder@example.com", "export-intruder");
    const wrongSeller = await request(app.getHttpServer())
      .get(`/sellers/me/data-export/${run.id}/download/products`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(wrongSeller.status).toBe(404);

    const owner = await request(app.getHttpServer())
      .get(`/sellers/me/data-export/${run.id}/download/products`)
      .set("Authorization", `Bearer ${token}`);
    expect(owner.status).toBe(200);
  });

  it("an on-demand export request beyond the configured rate limit is rejected, not silently queued or double-generated (FR-36.1)", async () => {
    const { token } = await createStore("export-ratelimit@example.com", "export-ratelimit");

    const first = await request(app.getHttpServer()).post("/sellers/me/data-export").set("Authorization", `Bearer ${token}`);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer()).post("/sellers/me/data-export").set("Authorization", `Bearer ${token}`);
    expect(second.status).toBe(400);

    const rows = await superuser.sellerDataExport.count();
    expect(rows).toBe(1); // the rejected request never created a second row
  });

  it("with Drive connected (and upload-scoped), the export uploads to Drive; without it, the seller gets an email fallback (FR-36.3)", async () => {
    const withDrive = await createStore("export-drive@example.com", "export-drive");
    await connectDrive(withDrive.sellerId, { fileScope: true });
    const dataExport = app.get(DataExportService);

    const driveRun = await dataExport.requestOnDemandExport(withDrive.sellerId);
    await dataExport.processExport(driveRun.id);
    const driveCompleted = await superuser.sellerDataExport.findUniqueOrThrow({ where: { id: driveRun.id } });
    expect(driveCompleted.status).toBe("completed");
    expect(driveCompleted.deliveryMethod).toBe("drive");
    expect(fakeDriveClient.uploadFile).toHaveBeenCalled();

    const withoutDrive = await createStore("export-no-drive@example.com", "export-no-drive");
    const sendSpy = jest.spyOn(app.get(EmailService), "sendDataExportReadyEmail");
    const emailRun = await dataExport.requestOnDemandExport(withoutDrive.sellerId);
    await dataExport.processExport(emailRun.id);
    const emailCompleted = await superuser.sellerDataExport.findUniqueOrThrow({ where: { id: emailRun.id } });
    expect(emailCompleted.status).toBe("completed");
    expect(emailCompleted.deliveryMethod).toBe("email");
    // v0.28 security fix - the email fallback links to a login page, never
    // a raw, unauthenticated object-storage URL for a PII-bearing file.
    expect(sendSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("/login"));
    const [, link] = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
    expect(link).not.toContain("private-exports");
  });

  it("a connection made before the upload scope existed (drive.readonly only) correctly falls back to email rather than attempting an upload it can't perform", async () => {
    const { sellerId } = await createStore("export-old-scope@example.com", "export-old-scope");
    await connectDrive(sellerId, { fileScope: false });
    const dataExport = app.get(DataExportService);

    const run = await dataExport.requestOnDemandExport(sellerId);
    await dataExport.processExport(run.id);
    const completed = await superuser.sellerDataExport.findUniqueOrThrow({ where: { id: run.id } });
    expect(completed.deliveryMethod).toBe("email");
    expect(fakeDriveClient.uploadFile).not.toHaveBeenCalled();
  });

  it("a forced export-generation/delivery failure is logged and never blocks, delays, or fails the subscription renewal itself (FR-36.4)", async () => {
    const { token, sellerId } = await createStore("export-nonblocking@example.com", "export-nonblocking");
    await makeDueForRenewal("export-nonblocking@example.com", token, sellerId, "export-nonblocking");

    const planFeeDebit = app.get(PlanFeeDebitService);
    const sweep = await planFeeDebit.runMonthlyDebitSweep(new Date());
    expect(sweep.renewedSellerIds).toContain(sellerId);
    const subscriptionAfterRenewal = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    const ledgerCountAfterRenewal = await superuser.ledgerEntry.count({ where: { sellerId, type: "wallet_plan_fee_debit" } });
    expect(ledgerCountAfterRenewal).toBe(1);

    // Now force the export itself to fail outright (a bogus export ID - processExport must never throw).
    const dataExport = app.get(DataExportService);
    await expect(dataExport.processExport("00000000-0000-0000-0000-000000000000")).resolves.toBeUndefined();
    // triggerRenewalExport() must also never throw, even if enqueueing itself somehow failed.
    await expect(dataExport.triggerRenewalExport(sellerId)).resolves.toBeUndefined();

    // The already-completed renewal is provably untouched by any of the above.
    const subscriptionAfter = await superuser.subscription.findUniqueOrThrow({ where: { sellerId } });
    expect(subscriptionAfter.currentPeriodEnd?.getTime()).toBe(subscriptionAfterRenewal.currentPeriodEnd?.getTime());
    const ledgerCountAfter = await superuser.ledgerEntry.count({ where: { sellerId, type: "wallet_plan_fee_debit" } });
    expect(ledgerCountAfter).toBe(1);
  }, 30000);
});
