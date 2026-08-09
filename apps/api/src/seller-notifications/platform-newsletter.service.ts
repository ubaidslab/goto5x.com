import { randomBytes } from "crypto";
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { EmailService } from "../notifications/email.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { CreatePlatformNewsletterDto } from "./dto/create-platform-newsletter.dto";
import { PLATFORM_NEWSLETTER_JOB_NAME, PLATFORM_NEWSLETTER_QUEUE_NAME } from "./platform-newsletter.queue";

/**
 * Module 55 (SRS §5.62/FR-62.2-62.3) - the admin-composed platform
 * newsletter. Sent from UZEYN's own SMTP identity via the same EmailService
 * every other platform email already uses - unlike Module 34's
 * EmailCampaign, there is no seller-connected-mailbox credential to
 * decrypt, so sending is a plain EmailService.send() loop, not a copy of
 * campaign-mailer.util.ts's SMTP-client construction.
 */
@Injectable()
export class PlatformNewsletterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformNewsletterService.name);
  private queue?: Queue;

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.queue = new Queue(PLATFORM_NEWSLETTER_QUEUE_NAME, { connection: { url: this.config.getOrThrow<string>("REDIS_URL") } });
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  async create(adminId: string, dto: CreatePlatformNewsletterDto) {
    return this.prismaAdmin.platformNewsletter.create({
      data: { subject: dto.subject, body: dto.body, createdByAdminId: adminId },
    });
  }

  async list() {
    return this.prismaAdmin.platformNewsletter.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getOne(id: string) {
    const newsletter = await this.prismaAdmin.platformNewsletter.findUnique({ where: { id } });
    if (!newsletter) throw new NotFoundException("Newsletter not found.");
    return newsletter;
  }

  /** FR-62.2 - enqueues the send; the worker calls processNewsletter() below. */
  async send(id: string) {
    const newsletter = await this.getOne(id);
    if (newsletter.status !== "draft") {
      throw new BadRequestException(`This newsletter is already "${newsletter.status}".`);
    }
    await this.queue?.add(PLATFORM_NEWSLETTER_JOB_NAME, { newsletterId: id });
    return newsletter;
  }

  /**
   * FR-62.3 - segment membership (here: "every seller") AND opt-out status
   * are re-derived live at send time, never reused from a count captured
   * at creation, same discipline Module 34's processCampaign() already
   * established - an opt-out that happens between creation and send is
   * still honored.
   */
  async processNewsletter(newsletterId: string): Promise<void> {
    const newsletter = await this.prismaAdmin.platformNewsletter.findUnique({ where: { id: newsletterId } });
    if (!newsletter) return;

    try {
      await this.prismaAdmin.platformNewsletter.update({ where: { id: newsletterId }, data: { status: "sending" } });

      const eligibleSellers = await this.prismaAdmin.seller.findMany({
        where: { newsletterOptOut: false },
        include: { user: true },
      });
      const appBaseUrl = this.config.getOrThrow<string>("APP_BASE_URL");

      let sentCount = 0;
      let failedCount = 0;
      for (const seller of eligibleSellers) {
        try {
          const token = seller.newsletterUnsubscribeToken ?? (await this.ensureUnsubscribeToken(seller.id));
          const unsubscribeUrl = `${appBaseUrl}/unsubscribe?type=newsletter&token=${token}`;
          await this.email.send(
            seller.user.email,
            newsletter.subject,
            `${newsletter.body}\n\n---\nDon't want these emails? Unsubscribe: ${unsubscribeUrl}`,
          );
          sentCount++;
        } catch (err) {
          failedCount++;
          this.logger.warn(`Newsletter ${newsletterId}: failed to send to seller ${seller.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      await this.prismaAdmin.platformNewsletter.update({
        where: { id: newsletterId },
        data: { status: "sent", sentCount, failedCount, recipientCount: eligibleSellers.length, sentAt: new Date() },
      });
    } catch (err) {
      await this.prismaAdmin.platformNewsletter
        .update({
          where: { id: newsletterId },
          data: { status: "failed", failureReason: err instanceof Error ? err.message : "Unknown error" },
        })
        .catch(() => undefined);
    }
  }

  /** Lazily mints a seller's newsletter unsubscribe token once, reused for their lifetime (FR-62.3). */
  private async ensureUnsubscribeToken(sellerId: string): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const updated = await this.prismaAdmin.seller.update({ where: { id: sellerId }, data: { newsletterUnsubscribeToken: token } });
    return updated.newsletterUnsubscribeToken!;
  }

  /** FR-62.3 - public, unauthenticated; idempotent. */
  async unsubscribe(token: string): Promise<{ unsubscribed: true }> {
    const seller = await this.prismaAdmin.seller.findUnique({ where: { newsletterUnsubscribeToken: token } });
    if (!seller) throw new NotFoundException("Invalid unsubscribe link.");
    if (!seller.newsletterOptOut) {
      await this.prismaAdmin.seller.update({ where: { id: seller.id }, data: { newsletterOptOut: true } });
    }
    return { unsubscribed: true };
  }
}
