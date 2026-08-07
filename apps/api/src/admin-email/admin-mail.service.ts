import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import * as nodemailer from "nodemailer";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { decryptAdminEmailCredential } from "./admin-email-credential-crypto.util";
import { SendAdminEmailReplyDto } from "./dto/send-admin-email-reply.dto";

const MESSAGES_PER_ACCOUNT = 20;

export interface UnifiedInboxMessage {
  accountId: string;
  accountEmailAddress: string;
  uid: number;
  from: string;
  subject: string;
  date: Date | null;
  snippet: string;
}

/**
 * SRS §5.53/FR-53.3 - fetches each linked account's INBOX over real IMAP
 * (imapflow) and merges the results into one unified, date-sorted list; a
 * reply always sends through the originating account's own SMTP
 * credentials (nodemailer), never a shared/default sender.
 */
@Injectable()
export class AdminMailService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    config: ConfigService,
  ) {
    this.encryptionKey = Buffer.from(config.getOrThrow<string>("ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY"), "base64");
  }

  async fetchUnifiedInbox(): Promise<UnifiedInboxMessage[]> {
    const accounts = await this.prisma.adminEmailAccount.findMany();
    const perAccount = await Promise.all(accounts.map((account) => this.fetchAccountInbox(account)));
    return perAccount.flat().sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  }

  private async fetchAccountInbox(account: {
    id: string;
    emailAddress: string;
    imapHost: string;
    imapPort: number;
    imapUseTls: boolean;
    imapUsername: string;
    imapPasswordEncrypted: string;
  }): Promise<UnifiedInboxMessage[]> {
    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapUseTls,
      auth: {
        user: account.imapUsername,
        pass: decryptAdminEmailCredential(account.imapPasswordEncrypted, this.encryptionKey),
      },
      logger: false,
    });

    const messages: UnifiedInboxMessage[] = [];
    await client.connect();
    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const mailbox = client.mailbox;
        const messageCount = mailbox && typeof mailbox !== "boolean" ? mailbox.exists : 0;
        if (messageCount > 0) {
          const start = Math.max(1, messageCount - MESSAGES_PER_ACCOUNT + 1);
          for await (const msg of client.fetch(`${start}:*`, { envelope: true, source: true })) {
            const parsed = msg.source ? await simpleParser(msg.source) : null;
            messages.push({
              accountId: account.id,
              accountEmailAddress: account.emailAddress,
              uid: msg.uid,
              from: msg.envelope?.from?.[0]?.address ?? "",
              subject: msg.envelope?.subject ?? "",
              date: msg.envelope?.date ?? null,
              snippet: (parsed?.text ?? "").trim().slice(0, 280),
            });
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
    return messages;
  }

  /** FR-53.3 - always sends via the originating account's own SMTP credentials. */
  async sendReply(dto: SendAdminEmailReplyDto, adminUserId: string | undefined): Promise<void> {
    // Phase B pre-launch audit finding - sends a real outbound email via a
    // linked business account's own SMTP credentials to a caller-supplied
    // `to` address; no rate limit beyond the generic 100/min IP throttle
    // previously, so a compromised admin session could spam arbitrary
    // recipients from UZEYN's own domains.
    const replyLimit = await this.settings.resolve<number>("admin_email.reply_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`admin-email-reply:${adminUserId ?? "unknown"}`, replyLimit);

    const account = await this.prisma.adminEmailAccount.findUniqueOrThrow({ where: { id: dto.accountId } });
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpUseTls,
      auth: {
        user: account.smtpUsername,
        pass: decryptAdminEmailCredential(account.smtpPasswordEncrypted, this.encryptionKey),
      },
    });
    await transporter.sendMail({
      from: account.emailAddress,
      to: dto.to,
      subject: dto.subject,
      text: dto.body,
      inReplyTo: dto.inReplyTo,
    });
  }
}
