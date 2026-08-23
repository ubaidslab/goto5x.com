import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { EmailService } from "../../src/notifications/email.service";
import { SupportTicketSlaService } from "../../src/support-tickets/support-ticket-sla.service";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";

const PASSWORD = "correct-horse-battery";
const ADMIN_PASSWORD = "admin-correct-horse-battery";
const HOUR_MS = 60 * 60 * 1000;

/**
 * SRS §5.6k (v0.41), FR-6.45 (Module 68) + FR-8.18 (Module 90) - support
 * SLA by plan (GO 48h/RUN 24h/RISE 12h/FLY 4h) now enforced against a real
 * minimal ticket system: subject/body, a plain-text reply thread, a
 * per-plan SLA deadline computed once at creation, and an 80%-of-window
 * near-breach sweep.
 */
describe("Support SLA + minimal ticket system (e2e) - SRS §5.6k/§14.66 (Module 68/90, FR-6.45/FR-8.18)", () => {
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
    return { token, sellerId: seller.id as string };
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

  it("FR-6.45/FR-8.18: a GO-tier ticket gets a 48h SLA deadline computed once at creation, and a reply thread works both ways", async () => {
    const adminToken = await createAndLoginAdmin("ticket-admin1@example.com");
    const seller = await signup("ticket-go@example.com");
    const store = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${seller.token}`).send({ name: "Store", slug: "ticket-go-store" });
    const storeId = store.body.id as string;

    const before = new Date();
    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/support-tickets`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ subject: "Checkout is broken", body: "Buyers can't complete checkout." });
    expect(create.status).toBe(201);
    const ticketId = create.body.id as string;
    const slaDeadline = new Date(create.body.slaDeadline);
    const hoursUntilDeadline = (slaDeadline.getTime() - before.getTime()) / HOUR_MS;
    expect(hoursUntilDeadline).toBeCloseTo(48, 0); // GO tier

    const adminReply = await request(app.getHttpServer())
      .post(`/admin/support-tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ body: "Looking into it now." });
    expect(adminReply.status).toBe(201);
    expect(adminReply.body.authorType).toBe("admin");

    const sellerReply = await request(app.getHttpServer())
      .post(`/stores/${storeId}/support-tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ body: "Thanks, still broken though." });
    expect(sellerReply.status).toBe(201);

    const thread = await request(app.getHttpServer())
      .get(`/stores/${storeId}/support-tickets/${ticketId}`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(thread.body.messages).toHaveLength(3); // initial + admin + seller

    const resolve = await request(app.getHttpServer())
      .post(`/admin/support-tickets/${ticketId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(resolve.status).toBe(201);
    expect(resolve.body.status).toBe("resolved");

    const auditRow = await superuser.adminAuditLog.findFirst({ where: { action: "support.ticket_resolved", targetId: ticketId } });
    expect(auditRow).not.toBeNull();
  });

  it("FR-6.45: a FLY-tier ticket gets the founder-specified 4h SLA deadline, not GO's 48h", async () => {
    const seller = await signup("ticket-fly@example.com");
    const flyPlan = await superuser.plan.findFirstOrThrow({ where: { planGroup: "individual", tierOrder: 3 } });
    await superuser.subscription.update({ where: { sellerId: seller.sellerId }, data: { planId: flyPlan.id } });
    const store = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${seller.token}`).send({ name: "Store", slug: "ticket-fly-store" });
    const storeId = store.body.id as string;

    const before = new Date();
    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/support-tickets`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ subject: "Urgent", body: "Need help fast." });
    const slaDeadline = new Date(create.body.slaDeadline);
    const hoursUntilDeadline = (slaDeadline.getTime() - before.getTime()) / HOUR_MS;
    expect(hoursUntilDeadline).toBeCloseTo(4, 0);
  });

  it("RLS tenant isolation: a seller cannot see another store's support tickets", async () => {
    const sellerA = await signup("ticket-tenant-a@example.com");
    const sellerB = await signup("ticket-tenant-b@example.com");
    const storeA = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${sellerA.token}`).send({ name: "A", slug: "ticket-tenant-a-store" });
    const storeB = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${sellerB.token}`).send({ name: "B", slug: "ticket-tenant-b-store" });
    const create = await request(app.getHttpServer())
      .post(`/stores/${storeA.body.id}/support-tickets`)
      .set("Authorization", `Bearer ${sellerA.token}`)
      .send({ subject: "A's ticket", body: "..." });

    const crossRead = await request(app.getHttpServer())
      .get(`/stores/${storeB.body.id}/support-tickets/${create.body.id}`)
      .set("Authorization", `Bearer ${sellerB.token}`);
    expect(crossRead.status).toBe(404);
  });

  it("FR-8.18: the near-breach sweep flags a ticket once it crosses 80% of its SLA window, emails every admin, and never re-flags it", async () => {
    const admin1 = await createAndLoginAdmin("ticket-nb-admin1@example.com");
    void admin1;
    await createAndLoginAdmin("ticket-nb-admin2@example.com");
    const seller = await signup("ticket-nearbreach@example.com");
    const store = await request(app.getHttpServer()).post("/stores").set("Authorization", `Bearer ${seller.token}`).send({ name: "Store", slug: "ticket-nb-store" });
    const storeId = store.body.id as string;
    const create = await request(app.getHttpServer())
      .post(`/stores/${storeId}/support-tickets`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({ subject: "Slow", body: "..." });
    const ticketId = create.body.id as string;

    const emailSpy = jest.spyOn(app.get(EmailService), "sendTicketNearBreachEmail");
    const sla = app.get(SupportTicketSlaService);

    // 48h GO window - well before 80% (38.4h), nothing should fire yet.
    const early = await sla.runSweep(new Date(Date.now() + 10 * HOUR_MS));
    expect(early.flagged).toBe(0);
    expect(emailSpy).not.toHaveBeenCalled();

    // Past the 80% mark.
    const late = await sla.runSweep(new Date(Date.now() + 40 * HOUR_MS));
    expect(late.flagged).toBe(1);
    expect(emailSpy).toHaveBeenCalledTimes(2); // one per admin account

    const ticket = await superuser.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.nearBreachNotifiedAt).not.toBeNull();

    // Running again must not re-flag (nearBreachNotifiedAt already set).
    const again = await sla.runSweep(new Date(Date.now() + 41 * HOUR_MS));
    expect(again.flagged).toBe(0);
    expect(emailSpy).toHaveBeenCalledTimes(2);
  });
});
