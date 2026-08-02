import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { decryptSmtpCredential, encryptSmtpCredential } from "./smtp-credential-crypto.util";

const MAX_ACTIVE_SENDERS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const SAFE_SELECT = {
  id: true,
  emailAddress: true,
  smtpHost: true,
  smtpPort: true,
  smtpUsername: true,
  dailySendCount: true,
  dailySendCountResetAt: true,
  status: true,
  connectedAt: true,
} as const;

/**
 * SRS §5.37/FR-37.3 - a seller's own connected SMTP senders for the
 * Email OTP channel. `seller_verification_emails` is deliberately
 * seller-scoped only (no store_id, no RLS policy - see the migration's own
 * comment), so every method here goes through PrismaAdminService with an
 * explicit sellerId filter, same as Seller/Subscription-tier services,
 * never TenantPrismaService.
 */
@Injectable()
export class SellerVerificationEmailsService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    config: ConfigService,
  ) {
    this.encryptionKey = Buffer.from(config.getOrThrow<string>("SMTP_CREDENTIAL_ENCRYPTION_KEY"), "base64");
  }

  async list(sellerId: string) {
    return this.prismaAdmin.sellerVerificationEmail.findMany({
      where: { sellerId },
      select: SAFE_SELECT,
      orderBy: { connectedAt: "asc" },
    });
  }

  /** FR-37.3 - 1-5 connected senders allowed, app-layer enforced same as elsewhere in this schema. */
  async connect(
    sellerId: string,
    input: { emailAddress: string; smtpHost: string; smtpPort: number; smtpUsername: string; smtpPassword: string },
  ) {
    const activeCount = await this.prismaAdmin.sellerVerificationEmail.count({
      where: { sellerId, status: "active" },
    });
    if (activeCount >= MAX_ACTIVE_SENDERS) {
      throw new BadRequestException(`You can connect at most ${MAX_ACTIVE_SENDERS} sender emails.`);
    }

    const smtpPasswordEncrypted = encryptSmtpCredential(input.smtpPassword, this.encryptionKey);
    return this.prismaAdmin.sellerVerificationEmail.create({
      data: {
        sellerId,
        emailAddress: input.emailAddress,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpUsername: input.smtpUsername,
        smtpPasswordEncrypted,
      },
      select: SAFE_SELECT,
    });
  }

  async revoke(sellerId: string, id: string) {
    const sender = await this.prismaAdmin.sellerVerificationEmail.findUnique({ where: { id } });
    if (!sender || sender.sellerId !== sellerId) throw new NotFoundException("Sender email not found.");
    return this.prismaAdmin.sellerVerificationEmail.update({
      where: { id },
      data: { status: "revoked" },
      select: SAFE_SELECT,
    });
  }

  /**
   * FR-37.3 rotation: picks the active sender with the most remaining
   * headroom under the store's daily cap, resetting any sender whose
   * 24-hour window has elapsed first. Returns null when the seller has no
   * active sender at all (caller decides how to fail).
   */
  async pickSenderForSend(sellerId: string, storeId: string) {
    const dailyCap = await this.settings.resolve<number>("orders.verification_email_daily_send_cap", { storeId });
    const senders = await this.prismaAdmin.sellerVerificationEmail.findMany({
      where: { sellerId, status: "active" },
    });
    if (senders.length === 0) return null;

    const now = new Date();
    const withFreshCounts = await Promise.all(
      senders.map(async (sender) => {
        if (now.getTime() - sender.dailySendCountResetAt.getTime() < DAY_MS) return sender;
        return this.prismaAdmin.sellerVerificationEmail.update({
          where: { id: sender.id },
          data: { dailySendCount: 0, dailySendCountResetAt: now },
        });
      }),
    );

    const underCap = withFreshCounts.filter((s) => s.dailySendCount < dailyCap);
    if (underCap.length === 0) return null;

    const chosen = underCap.reduce((lowest, s) => (s.dailySendCount < lowest.dailySendCount ? s : lowest));
    return chosen;
  }

  async recordSend(senderId: string) {
    await this.prismaAdmin.sellerVerificationEmail.update({
      where: { id: senderId },
      data: { dailySendCount: { increment: 1 } },
    });
  }

  /** Internal use only (OrderVerificationService) - never returned over the API. */
  decryptCredential(sender: { smtpPasswordEncrypted: string }): string {
    return decryptSmtpCredential(sender.smtpPasswordEncrypted, this.encryptionKey);
  }
}
