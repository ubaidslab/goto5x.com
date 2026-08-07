import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ImapFlow } from "imapflow";
import * as nodemailer from "nodemailer";
import { AuditLogService } from "../admin/audit-log.service";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { SettingsService } from "../settings-registry/settings.service";
import { decryptAdminEmailCredential, encryptAdminEmailCredential } from "./admin-email-credential-crypto.util";
import { LinkAdminEmailAccountDto } from "./dto/link-admin-email-account.dto";

const SAFE_SELECT = {
  id: true,
  emailAddress: true,
  displayName: true,
  imapHost: true,
  imapPort: true,
  imapUseTls: true,
  imapUsername: true,
  smtpHost: true,
  smtpPort: true,
  smtpUseTls: true,
  smtpUsername: true,
  createdAt: true,
} as const;

/**
 * SRS §5.53/FR-53.1-53.5 - admin-manageable linked email accounts for
 * UZEYN's own unified inbox. Admin-global, no RLS (same category as
 * AdminAuditLog/ImpersonationSession) - queried via PrismaRuntimeService,
 * same as ImpersonationSession, not PrismaAdminService (that's reserved
 * for RLS-bypass on tenant-scoped tables).
 */
@Injectable()
export class AdminEmailAccountsService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly auditLog: AuditLogService,
    private readonly rateLimit: RateLimitService,
    private readonly settings: SettingsService,
    config: ConfigService,
  ) {
    this.encryptionKey = Buffer.from(config.getOrThrow<string>("ADMIN_EMAIL_CREDENTIAL_ENCRYPTION_KEY"), "base64");
  }

  async list() {
    return this.prisma.adminEmailAccount.findMany({ select: SAFE_SELECT, orderBy: { createdAt: "asc" } });
  }

  async link(adminUserId: string | undefined, dto: LinkAdminEmailAccountDto) {
    const created = await this.prisma.adminEmailAccount.create({
      data: {
        emailAddress: dto.emailAddress,
        displayName: dto.displayName,
        imapHost: dto.imapHost,
        imapPort: dto.imapPort,
        imapUseTls: dto.imapUseTls ?? true,
        imapUsername: dto.imapUsername,
        imapPasswordEncrypted: encryptAdminEmailCredential(dto.imapPassword, this.encryptionKey),
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpUseTls: dto.smtpUseTls ?? false,
        smtpUsername: dto.smtpUsername,
        smtpPasswordEncrypted: encryptAdminEmailCredential(dto.smtpPassword, this.encryptionKey),
        linkedByAdminUserId: adminUserId ?? null,
      },
      select: SAFE_SELECT,
    });

    await this.auditLog.record({
      adminUserId,
      action: "admin_email.account.link",
      targetType: "admin_email_account",
      targetId: created.id,
      afterValue: created,
    });
    return created;
  }

  async unlink(adminUserId: string | undefined, id: string) {
    const existing = await this.prisma.adminEmailAccount.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!existing) throw new NotFoundException("Linked email account not found.");

    await this.prisma.adminEmailAccount.delete({ where: { id } });
    await this.auditLog.record({
      adminUserId,
      action: "admin_email.account.unlink",
      targetType: "admin_email_account",
      targetId: id,
      beforeValue: existing,
    });
    return { id };
  }

  /** FR-53.5 - "test-connection", a distinct on-demand action from add/remove. */
  async testConnection(id: string, adminUserId: string | undefined): Promise<{ imapOk: boolean; smtpOk: boolean; error?: string }> {
    // Phase B pre-launch audit finding - opens real IMAP+SMTP connections on
    // demand; no cooldown beyond the generic 100/min IP throttle previously.
    const testConnLimit = await this.settings.resolve<number>("admin_email.test_connection_rate_limit_per_hour");
    await this.rateLimit.enforcePerHour(`admin-email-test-connection:${adminUserId ?? "unknown"}`, testConnLimit);

    const account = await this.prisma.adminEmailAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException("Linked email account not found.");

    let imapOk = false;
    let smtpOk = false;
    const errors: string[] = [];

    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapUseTls,
      auth: { user: account.imapUsername, pass: decryptAdminEmailCredential(account.imapPasswordEncrypted, this.encryptionKey) },
      logger: false,
    });
    try {
      await client.connect();
      imapOk = true;
      await client.logout();
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "IMAP connection failed.");
    }

    try {
      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpUseTls,
        auth: { user: account.smtpUsername, pass: decryptAdminEmailCredential(account.smtpPasswordEncrypted, this.encryptionKey) },
      });
      smtpOk = await transporter.verify();
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "SMTP connection failed.");
    }

    return { imapOk, smtpOk, error: errors.length > 0 ? errors.join(" ") : undefined };
  }
}
