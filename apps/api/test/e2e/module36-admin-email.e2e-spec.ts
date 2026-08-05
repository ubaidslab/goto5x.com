import { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { buildTestApp, resetDatabase, resetRedis, seedSettings, superuserPrismaForTests } from "./setup";
import { startTestImapServer, TestImapServer } from "./imap-test-server";
import { startTestSmtpServer, TestSmtpServer } from "./smtp-test-server";

const ADMIN_PASSWORD = "admin-correct-horse-battery";
const IMAP_PORT_A = 14300;
const IMAP_PORT_B = 14301;
const SMTP_PORT_A = 2528;
const SMTP_PORT_B = 2529;

/**
 * Module 36 (SRS §5.53, §14.53) - Admin Email Section. Real IMAP servers
 * (hoodiecrow-imap) and real SMTP servers (smtp-server, same test double
 * as Module 26/34) rather than mocked imapflow/nodemailer - the whole
 * point is proving the actual connect/fetch/send calls work, same
 * reasoning as every other real-protocol e2e spec in this suite.
 */
describe("Admin Email Section (e2e) - SRS §5.53, §14.53", () => {
  let app: INestApplication;
  let superuser: PrismaClient;
  let imapServerA: TestImapServer;
  let imapServerB: TestImapServer;
  let smtpServerA: TestSmtpServer;
  let smtpServerB: TestSmtpServer;

  beforeAll(async () => {
    superuser = superuserPrismaForTests();
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    app = await buildTestApp();

    imapServerA = await startTestImapServer(IMAP_PORT_A, "support@example.com", "imap-pass-a", [
      {
        from: "customer1@example.com",
        to: "support@example.com",
        subject: "Order question",
        date: "Mon, 01 Jan 2024 10:00:00 +0000",
        text: "Hi, where is my order?",
      },
    ]);
    imapServerB = await startTestImapServer(IMAP_PORT_B, "helpdesk@example.com", "imap-pass-b", [
      {
        from: "customer2@example.com",
        to: "helpdesk@example.com",
        subject: "Refund request",
        date: "Tue, 02 Jan 2024 10:00:00 +0000",
        text: "I would like a refund.",
      },
    ]);
    smtpServerA = await startTestSmtpServer(SMTP_PORT_A);
    smtpServerB = await startTestSmtpServer(SMTP_PORT_B);
  });

  afterAll(async () => {
    await app.close();
    await superuser.$disconnect();
    await imapServerA.close();
    await imapServerB.close();
    await smtpServerA.close();
    await smtpServerB.close();
  });

  afterEach(async () => {
    await resetDatabase(superuser);
    await resetRedis();
    await seedSettings(superuser);
    smtpServerA.messages.length = 0;
    smtpServerB.messages.length = 0;
  });

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

  async function linkAccount(
    adminToken: string,
    emailAddress: string,
    imapPort: number,
    imapUsername: string,
    imapPassword: string,
    smtpPort: number,
  ) {
    const res = await request(app.getHttpServer())
      .post("/admin/email/accounts")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        emailAddress,
        imapHost: "127.0.0.1",
        imapPort,
        imapUseTls: false,
        imapUsername,
        imapPassword,
        smtpHost: "127.0.0.1",
        smtpPort,
        smtpUseTls: false,
        smtpUsername: emailAddress,
        smtpPassword: "smtp-pass-does-not-matter",
      });
    return res;
  }

  it("FR-53.2: IMAP/SMTP passwords are stored encrypted, never plaintext in an API response", async () => {
    const adminToken = await createAndLoginAdmin("owner1@example.com");
    const linked = await linkAccount(adminToken, "support@example.com", IMAP_PORT_A, "support@example.com", "imap-pass-a", SMTP_PORT_A);
    expect(linked.status).toBe(201);
    expect(linked.body.imapPasswordEncrypted).toBeUndefined();
    expect(linked.body.smtpPasswordEncrypted).toBeUndefined();

    const row = await superuser.adminEmailAccount.findUniqueOrThrow({ where: { id: linked.body.id } });
    expect(row.imapPasswordEncrypted).not.toContain("imap-pass-a");
    expect(row.smtpPasswordEncrypted).not.toContain("smtp-pass-does-not-matter");
    expect(row.imapPasswordEncrypted.split(":")).toHaveLength(3);
  });

  it("FR-53.3: the unified inbox merges two linked accounts' messages into one date-sorted list", async () => {
    const adminToken = await createAndLoginAdmin("owner2@example.com");
    await linkAccount(adminToken, "support@example.com", IMAP_PORT_A, "support@example.com", "imap-pass-a", SMTP_PORT_A);
    await linkAccount(adminToken, "helpdesk@example.com", IMAP_PORT_B, "helpdesk@example.com", "imap-pass-b", SMTP_PORT_B);

    const inbox = await request(app.getHttpServer())
      .get("/admin/email/inbox")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(inbox.status).toBe(200);
    expect(inbox.body).toHaveLength(2);
    // Newest first: the helpdesk@ message (Jan 2) sorts before the support@ message (Jan 1).
    expect(inbox.body[0].accountEmailAddress).toBe("helpdesk@example.com");
    expect(inbox.body[0].subject).toBe("Refund request");
    expect(inbox.body[1].accountEmailAddress).toBe("support@example.com");
    expect(inbox.body[1].subject).toBe("Order question");
  });

  it("FR-53.3: a reply sends via the originating account's own SMTP credentials, not a shared sender", async () => {
    const adminToken = await createAndLoginAdmin("owner3@example.com");
    const support = await linkAccount(adminToken, "support@example.com", IMAP_PORT_A, "support@example.com", "imap-pass-a", SMTP_PORT_A);
    await linkAccount(adminToken, "helpdesk@example.com", IMAP_PORT_B, "helpdesk@example.com", "imap-pass-b", SMTP_PORT_B);

    const reply = await request(app.getHttpServer())
      .post("/admin/email/reply")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        accountId: support.body.id,
        to: "customer1@example.com",
        subject: "Re: Order question",
        body: "It shipped yesterday!",
      });
    expect(reply.status).toBe(201);

    expect(smtpServerA.messages).toHaveLength(1);
    expect(smtpServerA.messages[0].from).toBe("support@example.com");
    expect(smtpServerA.messages[0].to).toEqual(["customer1@example.com"]);
    expect(smtpServerB.messages).toHaveLength(0);
  });

  it("FR-53.5: every link/unlink action is recorded in AdminAuditLog with before/after values", async () => {
    const adminToken = await createAndLoginAdmin("owner4@example.com");
    const linked = await linkAccount(adminToken, "support@example.com", IMAP_PORT_A, "support@example.com", "imap-pass-a", SMTP_PORT_A);

    const linkEvent = await superuser.adminAuditLog.findFirst({
      where: { action: "admin_email.account.link", targetId: linked.body.id },
    });
    expect(linkEvent).not.toBeNull();
    expect((linkEvent!.afterValue as { emailAddress: string }).emailAddress).toBe("support@example.com");

    const unlink = await request(app.getHttpServer())
      .delete(`/admin/email/accounts/${linked.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(unlink.status).toBe(200);

    const unlinkEvent = await superuser.adminAuditLog.findFirst({
      where: { action: "admin_email.account.unlink", targetId: linked.body.id },
    });
    expect(unlinkEvent).not.toBeNull();
    expect((unlinkEvent!.beforeValue as { emailAddress: string }).emailAddress).toBe("support@example.com");

    const list = await request(app.getHttpServer())
      .get("/admin/email/accounts")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body).toHaveLength(0);
  });
});
