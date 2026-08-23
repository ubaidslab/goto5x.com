import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { SubscriptionAbuseService } from "../../src/trust-safety/subscription-abuse.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const VALID_CNIC_A = "3541234567899";
const VALID_CNIC_B = "4123456789011"; // real Luhn-valid, unlike trust-safety.e2e-spec.ts's own VALID_CNIC_B, which that file never actually asserts a 200 for

/**
 * SRS §5.6k (v0.41), FR-6.48 (Module 71) - first-cycle discount abuse
 * prevention across all three trigger points (signup; CNIC set; payment-
 * instructions set), the durable flag, and the one-time retroactive
 * chargeback.
 */
describe("First-cycle discount abuse prevention (e2e) - SRS §5.6k/§14.66 (Module 71, FR-6.48)", () => {
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

  async function signup(email: string) {
    await request(app.getHttpServer())
      .post("/auth/signup")
      .send({ agreementAccepted: true, email, password: PASSWORD, businessName: `Business for ${email}` });
    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken as string;
    const user = await superuser.user.findUniqueOrThrow({ where: { email } });
    // Every real signup in this e2e run shares the same test-client IP -
    // AuthService.signup() already calls SubscriptionAbuseService.checkAtSignup()
    // with that real IP, so the SECOND (and every later) seller in a test
    // gets a genuine (not a bug - the same signal RiskScoreService's own
    // device/IP check already fires on) device_cluster flag from sharing
    // it with whichever seller signed up first. Cleared here so each test
    // below can deterministically construct exactly the signal it wants to
    // isolate, rather than fighting this real but incidental test-
    // environment collision.
    const sellerForCleanup = await superuser.seller.findUnique({ where: { userId: user.id } });
    if (sellerForCleanup) {
      await superuser.subscriptionAbuseFlag.deleteMany({ where: { sellerId: sellerForCleanup.id } });
    }
    const seller = await superuser.seller.findUniqueOrThrow({ where: { userId: user.id } });
    return { token, sellerId: seller.id as string, userId: user.id as string };
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

  async function fullPrice(): Promise<number> {
    const goPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 0 } });
    return Number(goPlan.price);
  }

  it("FR-6.48: no signal match provisionally grants the first-cycle discount", async () => {
    const seller = await signup("abuse-clean@example.com");
    const preview = await request(app.getHttpServer()).get("/sellers/me/wallet/plan-fee-payment").set("Authorization", `Bearer ${seller.token}`);
    const price = await fullPrice();
    expect(Number(preview.body.amountDue)).toBeLessThan(price);
  });

  it("FR-6.48 trigger 1 (signup): a phone match denies the discount immediately and flags for review, no accusatory messaging (full standing price shown)", async () => {
    const sellerA = await signup("abuse-phone-a@example.com");
    await superuser.user.update({ where: { id: sellerA.userId }, data: { phone: "03001112222" } });
    const sellerB = await signup("abuse-phone-b@example.com");
    await superuser.user.update({ where: { id: sellerB.userId }, data: { phone: "03001112222" } });

    const abuseService = app.get(SubscriptionAbuseService);
    await abuseService.checkAtSignup(sellerB.sellerId, undefined, undefined);

    const flags = await superuser.subscriptionAbuseFlag.findMany({ where: { sellerId: sellerB.sellerId } });
    expect(flags).toHaveLength(1);
    expect(flags[0].matchedSignal).toBe("phone");

    const preview = await request(app.getHttpServer()).get("/sellers/me/wallet/plan-fee-payment").set("Authorization", `Bearer ${sellerB.token}`);
    const price = await fullPrice();
    expect(Number(preview.body.amountDue)).toBe(price); // full price, not discounted - same shape as any other price preview

    const adminToken = await createAndLoginAdmin("abuse-admin1@example.com");
    const adminFlags = await request(app.getHttpServer()).get("/admin/trust-safety/monitors/subscription-abuse").set("Authorization", `Bearer ${adminToken}`);
    expect(adminFlags.status).toBe(200);
    expect(adminFlags.body.some((f: { sellerId: string }) => f.sellerId === sellerB.sellerId)).toBe(true);
  });

  it("FR-6.48 trigger 1 (signup): a device/IP cluster match denies the discount", async () => {
    const sellerA = await signup("abuse-device-a@example.com");
    void sellerA;
    const sellerB = await signup("abuse-device-b@example.com");

    // Simulate a shared device fingerprint at signup time (RiskScoreService.hasDeviceIpSignal
    // scans user_security_events "signup" rows) - both signups already recorded one via
    // AuthService.signup(); back-date B's to share A's fingerprint.
    await superuser.userSecurityEvent.updateMany({
      where: { userId: sellerA.userId, eventType: "signup" },
      data: { deviceFingerprint: "shared-device-xyz" },
    });

    const abuseService = app.get(SubscriptionAbuseService);
    await abuseService.checkAtSignup(sellerB.sellerId, undefined, "shared-device-xyz");

    const flags = await superuser.subscriptionAbuseFlag.findMany({ where: { sellerId: sellerB.sellerId } });
    expect(flags.some((f) => f.matchedSignal === "device_cluster")).toBe(true);
  });

  it("FR-6.48 trigger 2 (CNIC set): a durable flag denies the discount forever, checked fresh on every preview", async () => {
    const sellerA = await signup("abuse-cnic-a@example.com");
    await superuser.user.update({ where: { id: sellerA.userId }, data: { phone: "03005556666" } });
    const sellerB = await signup("abuse-cnic-b@example.com");
    await superuser.user.update({ where: { id: sellerB.userId }, data: { phone: "03005556666" } });

    // No match detected at signup (phones set AFTER signup here for test-setup convenience)...
    const before = await request(app.getHttpServer()).get("/sellers/me/wallet/plan-fee-payment").set("Authorization", `Bearer ${sellerB.token}`);
    const price = await fullPrice();
    expect(Number(before.body.amountDue)).toBeLessThan(price);

    // ...but setting CNIC re-runs the full signal set and catches it.
    await request(app.getHttpServer()).patch("/sellers/me/cnic").set("Authorization", `Bearer ${sellerA.token}`).send({ cnic: VALID_CNIC_A });
    const cnicSet = await request(app.getHttpServer()).patch("/sellers/me/cnic").set("Authorization", `Bearer ${sellerB.token}`).send({ cnic: VALID_CNIC_B });
    expect(cnicSet.status).toBe(200);

    const flags = await superuser.subscriptionAbuseFlag.findMany({ where: { sellerId: sellerB.sellerId } });
    expect(flags.some((f) => f.matchedSignal === "phone")).toBe(true);

    const after = await request(app.getHttpServer()).get("/sellers/me/wallet/plan-fee-payment").set("Authorization", `Bearer ${sellerB.token}`);
    expect(Number(after.body.amountDue)).toBe(price); // now denied, permanently
  });

  it("FR-6.48: a retroactive match after the discount was already used posts a one-time wallet_plan_fee_debit for the difference, never twice", async () => {
    const adminToken = await createAndLoginAdmin("abuse-admin2@example.com");
    const sellerA = await signup("abuse-chargeback-a@example.com");
    await superuser.user.update({ where: { id: sellerA.userId }, data: { phone: "03007778888" } });

    // sellerB pays their FIRST cycle at the discounted rate before any match is found.
    const sellerB = await signup("abuse-chargeback-b@example.com");
    const submit = await request(app.getHttpServer()).post("/sellers/me/wallet/plan-fee-payment").set("Authorization", `Bearer ${sellerB.token}`).send({});
    await request(app.getHttpServer()).post(`/admin/wallet-topups/${submit.body.request.id}/verify`).set("Authorization", `Bearer ${adminToken}`);

    const price = await fullPrice();
    const discountPercent = 50; // seeded default, billing.first_cycle_discount_percent
    const discountAmount = Number((price * (discountPercent / 100)).toFixed(2));

    // The match is discovered only now (phone set post-payment, for test-setup convenience).
    await superuser.user.update({ where: { id: sellerB.userId }, data: { phone: "03007778888" } });
    const abuseService = app.get(SubscriptionAbuseService);
    await abuseService.checkOnCnicSet(sellerB.sellerId);

    const debits = await superuser.ledgerEntry.findMany({ where: { sellerId: sellerB.sellerId, type: "wallet_plan_fee_debit" } });
    expect(debits).toHaveLength(1);
    expect(Number(debits[0].amount)).toBeCloseTo(discountAmount, 1);

    // A second, independent match for the SAME seller must never charge again.
    await abuseService.checkOnCnicSet(sellerB.sellerId);
    const debitsAfter = await superuser.ledgerEntry.findMany({ where: { sellerId: sellerB.sellerId, type: "wallet_plan_fee_debit" } });
    expect(debitsAfter).toHaveLength(1);
  });

  it("FR-6.48 trigger 3 (payment instructions): a bank/JazzCash conflict is the strongest signal - the save is still rejected exactly as before, but the conflicting seller is flagged and charged back if already discounted", async () => {
    const adminToken = await createAndLoginAdmin("abuse-admin3@example.com");

    const sellerA = await signup("abuse-instrument-a@example.com");
    const storeA = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${sellerA.token}`).send({ name: "A", slug: "abuse-instrument-a-store" });
    await request(app.getHttpServer())
      .patch(`/stores/${storeA.body.id}/payment-instructions`)
      .set("Authorization", `Bearer ${sellerA.token}`)
      .send({ jazzcashNumber: "03009990001", jazzcashAccountTitle: "Seller A", nameDeclaredSelfOwned: true });

    // sellerB already used the first-cycle discount.
    const sellerB = await signup("abuse-instrument-b@example.com");
    const submit = await request(app.getHttpServer()).post("/sellers/me/wallet/plan-fee-payment").set("Authorization", `Bearer ${sellerB.token}`).send({});
    await request(app.getHttpServer()).post(`/admin/wallet-topups/${submit.body.request.id}/verify`).set("Authorization", `Bearer ${adminToken}`);

    const storeB = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${sellerB.token}`).send({ name: "B", slug: "abuse-instrument-b-store" });
    const conflict = await request(app.getHttpServer())
      .patch(`/stores/${storeB.body.id}/payment-instructions`)
      .set("Authorization", `Bearer ${sellerB.token}`)
      .send({ jazzcashNumber: "03009990001", jazzcashAccountTitle: "Seller B", nameDeclaredSelfOwned: true });
    expect(conflict.status).toBe(400); // unchanged behavior - the save is still rejected

    const flags = await superuser.subscriptionAbuseFlag.findMany({ where: { sellerId: sellerB.sellerId } });
    expect(flags.some((f) => f.matchedSignal === "payment_instrument")).toBe(true);

    const debits = await superuser.ledgerEntry.findMany({ where: { sellerId: sellerB.sellerId, type: "wallet_plan_fee_debit" } });
    expect(debits).toHaveLength(1);
  });
});
