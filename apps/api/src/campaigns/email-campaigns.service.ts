import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { randomBytes } from "crypto";
import { decryptSmtpCredential } from "../order-verification/smtp-credential-crypto.util";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { CustomerSegmentsService } from "../customer-segments/customer-segments.service";
import { EventsService } from "../events/events.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { sendCampaignEmail } from "./campaign-mailer.util";
import { EMAIL_CAMPAIGNS_JOB_NAME, EMAIL_CAMPAIGNS_QUEUE_NAME } from "./campaigns.queue";
import { CreateCampaignDto } from "./dto/create-campaign.dto";

/**
 * SRS §5.51/FR-51.1-51.7. Sends a basic campaign to exactly one saved
 * segment (Module 33), via the seller's own connected SMTP sender -
 * SellerVerificationEmail, reused as-is from Module 26 (FR-51.1). No new
 * credential store, no new encryption key.
 */
@Injectable()
export class EmailCampaignsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailCampaignsService.name);
  private queue?: Queue;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly customerSegments: CustomerSegmentsService,
    private readonly events: EventsService,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = Buffer.from(config.getOrThrow<string>("SMTP_CREDENTIAL_ENCRYPTION_KEY"), "base64");
  }

  onModuleInit() {
    this.queue = new Queue(EMAIL_CAMPAIGNS_QUEUE_NAME, { connection: { url: this.config.getOrThrow<string>("REDIS_URL") } });
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  /**
   * FR-51.2 - the monthly quota check happens BEFORE the campaign row
   * exists and BEFORE anything is queued: a send that would exceed the
   * remaining quota is rejected entirely, never partially sent. Same
   * check-then-act shape as ProductsService.create()'s catalog.product_limit
   * gate.
   */
  async create(sellerId: string, storeId: string, dto: CreateCampaignDto) {
    const segment = await this.customerSegments.getOne(sellerId, storeId, dto.segmentId);
    const eligibleCount = segment.members.filter((m) => !m.unsubscribedAt).length;

    const sender = await this.prismaAdmin.sellerVerificationEmail.findUnique({ where: { id: dto.senderEmailId } });
    if (!sender || sender.sellerId !== sellerId) throw new NotFoundException("Sender email not found.");
    if (sender.status !== "active") throw new BadRequestException("That sender email is not active.");

    const planContext = await this.subscriptions.getPlanContext(sellerId);
    const monthlyLimit = await this.settings.resolve<number>("email_campaigns.monthly_send_limit", planContext);
    const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

    const usedThisMonth = await this.tenantPrisma.run(sellerId, async (tx) => {
      const agg = await tx.emailCampaign.aggregate({ where: { sentAt: { gte: startOfMonth } }, _sum: { sentCount: true } });
      return agg._sum.sentCount ?? 0;
    });
    const remaining = monthlyLimit - usedThisMonth;
    if (eligibleCount > remaining) {
      throw new BadRequestException(
        `This campaign would send to ${eligibleCount} customers, exceeding your plan's remaining monthly email campaign quota (${remaining} of ${monthlyLimit} left this month). No emails were sent.`,
      );
    }

    const created = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.emailCampaign.create({
        data: {
          storeId,
          segmentId: dto.segmentId,
          senderEmailId: dto.senderEmailId,
          subject: dto.subject,
          body: dto.body,
          status: "queued",
          recipientCount: eligibleCount,
        },
      }),
    );

    await this.queue!.add(EMAIL_CAMPAIGNS_JOB_NAME, { campaignId: created.id });
    return created;
  }

  async list(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, (tx) =>
      tx.emailCampaign.findMany({
        where: { storeId },
        include: { segment: { select: { name: true } }, senderEmail: { select: { emailAddress: true } } },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async getOne(sellerId: string, storeId: string, campaignId: string) {
    const campaign = await this.tenantPrisma.run(sellerId, (tx) =>
      tx.emailCampaign.findUnique({
        where: { id: campaignId },
        include: { segment: { select: { name: true } }, senderEmail: { select: { emailAddress: true } } },
      }),
    );
    if (!campaign || campaign.storeId !== storeId) throw new NotFoundException("Campaign not found.");
    return campaign;
  }

  /**
   * FR-51.6 - runs as a background job (called by the BullMQ worker;
   * e2e tests call it directly, same precedent as
   * DataExportService.processExport()). Never throws - a failure is
   * recorded on the row itself, same discipline as Module 24's export
   * processor.
   *
   * FR-51.3 - segment membership AND unsubscribe status are re-derived
   * live here, at actual send time - never reused from the count
   * captured at creation - so an unsubscribe that happens between
   * creation and send is still honored.
   */
  async processCampaign(campaignId: string): Promise<void> {
    const campaign = await this.prismaAdmin.emailCampaign.findUnique({
      where: { id: campaignId },
      include: { store: true, senderEmail: true },
    });
    if (!campaign) return;

    try {
      await this.prismaAdmin.emailCampaign.update({ where: { id: campaignId }, data: { status: "sending" } });

      const sellerId = campaign.store.sellerId;
      const segmentDetail = await this.customerSegments.getOne(sellerId, campaign.storeId, campaign.segmentId);
      const eligible = segmentDetail.members.filter((m) => !m.unsubscribedAt);

      const smtpPasswordPlaintext = decryptSmtpCredential(campaign.senderEmail.smtpPasswordEncrypted, this.encryptionKey);
      const appBaseUrl = this.config.getOrThrow<string>("APP_BASE_URL");

      let sentCount = 0;
      let failedCount = 0;
      for (const customer of eligible) {
        try {
          const token = customer.unsubscribeToken ?? (await this.ensureUnsubscribeToken(customer.id));
          const unsubscribeUrl = `${appBaseUrl}/unsubscribe?token=${token}`;
          const text = `${campaign.body}\n\n---\nDon't want these emails? Unsubscribe: ${unsubscribeUrl}`;
          await sendCampaignEmail(
            {
              smtpHost: campaign.senderEmail.smtpHost,
              smtpPort: campaign.senderEmail.smtpPort,
              smtpUsername: campaign.senderEmail.smtpUsername,
              smtpPasswordPlaintext,
              emailAddress: campaign.senderEmail.emailAddress,
            },
            customer.email,
            campaign.subject,
            text,
          );
          sentCount++;
        } catch (err) {
          failedCount++;
          this.logger.warn(`Campaign ${campaignId}: failed to send to customer ${customer.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      await this.prismaAdmin.emailCampaign.update({
        where: { id: campaignId },
        data: { status: "sent", sentCount, failedCount, recipientCount: eligible.length, sentAt: new Date() },
      });

      await this.events.emit({
        eventType: "campaign.sent",
        actorType: "seller",
        actorId: sellerId,
        storeId: campaign.storeId,
        entityType: "campaign",
        entityId: campaignId,
        metadata: { recipientCount: eligible.length, sentCount, failedCount },
      });
    } catch (err) {
      await this.prismaAdmin.emailCampaign
        .update({
          where: { id: campaignId },
          data: { status: "failed", failureReason: err instanceof Error ? err.message : "Unknown error" },
        })
        .catch(() => undefined);
    }
  }

  /** Lazily mints a customer's unsubscribe token once, reused for their lifetime (FR-51.3). */
  private async ensureUnsubscribeToken(customerId: string): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const updated = await this.prismaAdmin.customer.update({ where: { id: customerId }, data: { unsubscribeToken: token } });
    return updated.unsubscribeToken!;
  }

  /**
   * FR-51.3 - public, unauthenticated (the buyer clicking the link never
   * had a session). Idempotent: clicking an already-used link is a no-op,
   * not an error.
   */
  async unsubscribe(token: string): Promise<{ unsubscribed: true }> {
    const customer = await this.prismaAdmin.customer.findUnique({ where: { unsubscribeToken: token } });
    if (!customer) throw new NotFoundException("Invalid unsubscribe link.");
    if (!customer.unsubscribedAt) {
      await this.prismaAdmin.customer.update({ where: { id: customer.id }, data: { unsubscribedAt: new Date() } });
    }
    return { unsubscribed: true };
  }
}
