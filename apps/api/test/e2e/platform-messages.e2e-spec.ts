import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

/**
 * Phase 3 item 17 (SRS FR-8.22, extends FR-8.15/FR-8.7) - the 4 gaps
 * closed in the existing PlatformMessage system: image field,
 * shown-count-limit trigger (popup channel), persistent per-account
 * shown-count tracking (PlatformMessageView, replacing the old
 * sessionStorage-only dismissal), and supplier targeting/delivery
 * (previously entirely missing).
 */
describe("Platform messages - broadcast announcements (e2e) - SRS FR-8.22", () => {
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

  async function signupLoginSeller(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    return login.body.accessToken as string;
  }

  async function signupLoginSupplier(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: "correct-horse-battery", businessName: `Supplier ${email}`, role: "supplier" });
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "correct-horse-battery" });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email }, include: { supplier: true } });
    return { token, supplierId: user.supplier!.id };
  }

  async function createAdminAndGetToken(email: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await superuser.user.create({
      data: { email, passwordHash, roleFlags: ["admin"], emailVerifiedAt: new Date() },
    });
    await superuser.adminUser.create({ data: { userId: user.id, role: "super_admin", mfaEnabled: false } });
    const login = await request(app.getHttpServer()).post("/admin/auth/login").send({ email, password });
    const enroll = await request(app.getHttpServer())
      .post("/admin/auth/mfa/enroll")
      .send({ preAuthToken: login.body.preAuthToken });
    const code = authenticator.generate(enroll.body.secret);
    const verify = await request(app.getHttpServer())
      .post("/admin/auth/mfa/verify")
      .send({ preAuthToken: login.body.preAuthToken, code });
    return verify.body.accessToken as string;
  }

  it("an 'all' broadcast with an image reaches both a seller and a supplier", async () => {
    const adminToken = await createAdminAndGetToken("admin-broadcast@example.com", "correct-horse-battery-1");
    const sellerToken = await signupLoginSeller("seller-broadcast@example.com");
    const { token: supplierToken } = await signupLoginSupplier("supplier-broadcast@example.com");

    const create = await request(app.getHttpServer())
      .post("/admin/messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ channel: "banner", targetType: "all", body: "Platform-wide notice", imageUrl: "https://cdn.example.com/notice.png" });
    expect(create.status).toBe(201);
    expect(create.body.imageUrl).toBe("https://cdn.example.com/notice.png");

    const sellerList = await request(app.getHttpServer()).get("/sellers/me/messages").set("Authorization", `Bearer ${sellerToken}`);
    expect(sellerList.body.map((m: any) => m.body)).toContain("Platform-wide notice");

    const supplierList = await request(app.getHttpServer()).get("/supplier/messages").set("Authorization", `Bearer ${supplierToken}`);
    expect(supplierList.body.map((m: any) => m.body)).toContain("Platform-wide notice");
  });

  it("a supplier-targeted message reaches only that supplier, not sellers or other suppliers", async () => {
    const adminToken = await createAdminAndGetToken("admin-target@example.com", "correct-horse-battery-1");
    const sellerToken = await signupLoginSeller("seller-target@example.com");
    const { token: targetToken, supplierId: targetSupplierId } = await signupLoginSupplier("supplier-target@example.com");
    const { token: otherToken } = await signupLoginSupplier("supplier-other@example.com");

    await request(app.getHttpServer())
      .post("/admin/messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ channel: "banner", targetType: "supplier", targetSupplierId, body: "For you specifically" });

    const targetList = await request(app.getHttpServer()).get("/supplier/messages").set("Authorization", `Bearer ${targetToken}`);
    expect(targetList.body.map((m: any) => m.body)).toContain("For you specifically");

    const otherList = await request(app.getHttpServer()).get("/supplier/messages").set("Authorization", `Bearer ${otherToken}`);
    expect(otherList.body.map((m: any) => m.body)).not.toContain("For you specifically");

    const sellerList = await request(app.getHttpServer()).get("/sellers/me/messages").set("Authorization", `Bearer ${sellerToken}`);
    expect(sellerList.body.map((m: any) => m.body)).not.toContain("For you specifically");
  });

  it("creating a supplier-targeted message without targetSupplierId is rejected (FR-8.22 DTO validation)", async () => {
    const adminToken = await createAdminAndGetToken("admin-validate@example.com", "correct-horse-battery-1");
    const res = await request(app.getHttpServer())
      .post("/admin/messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ channel: "banner", targetType: "supplier", body: "Missing target" });
    expect(res.status).toBe(400);
  });

  it("a popup's maxShownCount is enforced server-side via persistent PlatformMessageView tracking, not sessionStorage", async () => {
    const adminToken = await createAdminAndGetToken("admin-shown@example.com", "correct-horse-battery-1");
    const sellerToken = await signupLoginSeller("seller-shown@example.com");

    const create = await request(app.getHttpServer())
      .post("/admin/messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ channel: "popup", targetType: "all", body: "Shown twice only", maxShownCount: 2 });
    const messageId = create.body.id as string;

    // Not yet marked shown - still eligible.
    const beforeShown = await request(app.getHttpServer()).get("/sellers/me/messages").set("Authorization", `Bearer ${sellerToken}`);
    expect(beforeShown.body.map((m: any) => m.id)).toContain(messageId);

    // Record 1 shown event - shownCount=1 < maxShownCount=2, still eligible.
    const shown1 = await request(app.getHttpServer())
      .post(`/sellers/me/messages/${messageId}/shown`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(shown1.status).toBe(201);
    const afterOne = await request(app.getHttpServer()).get("/sellers/me/messages").set("Authorization", `Bearer ${sellerToken}`);
    expect(afterOne.body.map((m: any) => m.id)).toContain(messageId);

    // Record a 2nd shown event - shownCount=2 >= maxShownCount=2, now excluded.
    await request(app.getHttpServer()).post(`/sellers/me/messages/${messageId}/shown`).set("Authorization", `Bearer ${sellerToken}`);
    const afterTwo = await request(app.getHttpServer()).get("/sellers/me/messages").set("Authorization", `Bearer ${sellerToken}`);
    expect(afterTwo.body.map((m: any) => m.id)).not.toContain(messageId);

    const view = await superuser.platformMessageView.findFirstOrThrow({ where: { messageId } });
    expect(view.shownCount).toBe(2);
  });

  it("maxShownCount tracking is per-account - a different seller still gets their own fresh count", async () => {
    const adminToken = await createAdminAndGetToken("admin-percount@example.com", "correct-horse-battery-1");
    const sellerAToken = await signupLoginSeller("seller-a-percount@example.com");
    const sellerBToken = await signupLoginSeller("seller-b-percount@example.com");

    const create = await request(app.getHttpServer())
      .post("/admin/messages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ channel: "popup", targetType: "all", body: "Per-account limit", maxShownCount: 1 });
    const messageId = create.body.id as string;

    await request(app.getHttpServer()).post(`/sellers/me/messages/${messageId}/shown`).set("Authorization", `Bearer ${sellerAToken}`);

    const sellerAList = await request(app.getHttpServer()).get("/sellers/me/messages").set("Authorization", `Bearer ${sellerAToken}`);
    expect(sellerAList.body.map((m: any) => m.id)).not.toContain(messageId);

    const sellerBList = await request(app.getHttpServer()).get("/sellers/me/messages").set("Authorization", `Bearer ${sellerBToken}`);
    expect(sellerBList.body.map((m: any) => m.id)).toContain(messageId);
  });
});
