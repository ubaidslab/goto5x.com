import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ContentPlatform, ProgramContentSubmission } from "@prisma/client";
import { AuditLogService } from "../admin/audit-log.service";
import { round2 } from "../orders/money.util";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

interface CertificateTierThreshold {
  name: string;
  threshold: number;
}

function currentCalendarMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * SRS §5.33 FR-33.5 (Ambassador rewards/tiers) and FR-33.7 (Creator
 * content-verification + view rewards).
 */
@Injectable()
export class ProgramRewardService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * FR-33.5 - "referring 12+ (Settings) paid store subscriptions within a
   * calendar month grants a selected premium plan free... or a refund of
   * that plan's fee if already purchased." v1.0 implements both outcomes
   * with one mechanism: credit the Ambassador's own current plan price as
   * a `program_reward_credit` - functionally equivalent to "this period's
   * plan fee is free" whether debited already or not, since the wallet
   * nets everything together. Idempotent per Ambassador per calendar
   * month via a ledger-entry existence check, same pattern as
   * PlanFeeDebitService's team-seat-total debit.
   */
  async runMonthlyAmbassadorRewardSweep(now = new Date()): Promise<{ rewarded: number }> {
    const threshold = await this.settings.resolve<number>("growth.ambassador_monthly_reward_threshold_subscriptions");
    const periodStart = currentCalendarMonthStart(now);

    const ambassadors = await this.prismaAdmin.programParticipant.findMany({
      where: { programType: "ambassador", status: "approved" },
    });

    let rewarded = 0;
    for (const ambassador of ambassadors) {
      const alreadyRewardedThisMonth = await this.prismaAdmin.ledgerEntry.findFirst({
        where: { sellerId: ambassador.sellerId, type: "program_reward_credit", createdAt: { gte: periodStart } },
      });
      if (alreadyRewardedThisMonth) continue;

      const newAttributionsThisMonth = await this.prismaAdmin.referralAttribution.count({
        where: { participantId: ambassador.id, attributedAt: { gte: periodStart } },
      });
      if (newAttributionsThisMonth < threshold) continue;

      const subscription = await this.prismaAdmin.subscription.findUnique({
        where: { sellerId: ambassador.sellerId },
        include: { plan: true },
      });
      const rewardAmount = subscription ? Number(subscription.plan.price) : 0;
      if (rewardAmount <= 0) continue;

      await this.prismaAdmin.ledgerEntry.create({
        data: { sellerId: ambassador.sellerId, type: "program_reward_credit", amount: rewardAmount, currency: subscription!.plan.currency },
      });
      rewarded += 1;
    }
    return { rewarded };
  }

  /**
   * FR-33.5 - certificate tier is always derived live against current
   * Settings Registry thresholds, never stored/cached (thresholds are
   * admin-editable data; a seller's displayed tier must reflect whatever
   * the thresholds are RIGHT NOW). "Lifetime referred paid-sales count" is
   * defined here as the count of this Ambassador's distinct referred
   * sellers who currently hold a paid plan (price > 0) - a disclosed,
   * concrete interpretation of the SRS's "referred paid-sales count"
   * phrasing, consistent with FR-33.5's own "12+ paid store subscriptions"
   * language for the monthly reward.
   */
  async currentCertificateTier(sellerId: string): Promise<{ tierName: string | null; lifetimeReferredPaidCount: number }> {
    const participant = await this.prismaAdmin.programParticipant.findUnique({
      where: { uniq_program_participant_seller_program: { sellerId, programType: "ambassador" } },
    });
    if (!participant) return { tierName: null, lifetimeReferredPaidCount: 0 };

    const attributions = await this.prismaAdmin.referralAttribution.findMany({
      where: { participantId: participant.id },
      select: { referredSellerId: true },
    });
    if (attributions.length === 0) return { tierName: null, lifetimeReferredPaidCount: 0 };

    const paidCount = await this.prismaAdmin.subscription.count({
      where: {
        sellerId: { in: attributions.map((a) => a.referredSellerId) },
        plan: { price: { gt: 0 } },
      },
    });

    const thresholds = await this.settings.resolve<CertificateTierThreshold[]>("growth.ambassador_certificate_tier_thresholds");
    const sorted = [...thresholds].sort((a, b) => b.threshold - a.threshold);
    const tier = sorted.find((t) => paidCount >= t.threshold);
    return { tierName: tier?.name ?? null, lifetimeReferredPaidCount: paidCount };
  }

  /** FR-33.7 - a Creator submits a content link + reported views; nothing pays out until an admin manually verifies it. */
  async submitContent(
    sellerId: string,
    platform: ContentPlatform,
    contentUrl: string,
    reportedViews: number,
  ): Promise<ProgramContentSubmission> {
    const participant = await this.prismaAdmin.programParticipant.findUnique({
      where: { uniq_program_participant_seller_program: { sellerId, programType: "creator" } },
    });
    if (!participant || participant.status !== "approved") {
      throw new ForbiddenException("You must be an approved Creator to submit content.");
    }
    return this.prismaAdmin.programContentSubmission.create({
      data: { participantId: participant.id, platform, contentUrl, reportedViews },
    });
  }

  async listOwnSubmissions(sellerId: string): Promise<ProgramContentSubmission[]> {
    const participant = await this.prismaAdmin.programParticipant.findUnique({
      where: { uniq_program_participant_seller_program: { sellerId, programType: "creator" } },
    });
    if (!participant) return [];
    return this.prismaAdmin.programContentSubmission.findMany({
      where: { participantId: participant.id },
      orderBy: { createdAt: "desc" },
    });
  }

  /** FR-33.11 - the content-link verification queue, pending submissions only. */
  async listVerificationQueue(): Promise<ProgramContentSubmission[]> {
    return this.prismaAdmin.programContentSubmission.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" } });
  }

  /**
   * FR-33.7 (binding) - a view count is an eligibility SIGNAL only, never
   * an automatic payout trigger. Verifying computes the reward (rate x
   * reported views, in millions) capped by the configured monthly-per-
   * creator cap, checked against everything ALREADY verified this
   * calendar month for this same creator - never against this submission
   * alone.
   */
  async verify(adminUserId: string, submissionId: string, notes: string | undefined): Promise<ProgramContentSubmission> {
    const submission = await this.requirePendingSubmission(submissionId);
    const ratePerMillion = await this.settings.resolve<number>("growth.creator_view_reward_per_million_pkr");
    const monthlyCap = await this.settings.resolve<number>("growth.creator_monthly_reward_cap_pkr");

    const rawReward = round2((submission.reportedViews / 1_000_000) * ratePerMillion);

    const periodStart = currentCalendarMonthStart(new Date());
    const alreadyVerifiedThisMonth = await this.prismaAdmin.programContentSubmission.findMany({
      where: { participantId: submission.participantId, status: "verified", verifiedAt: { gte: periodStart } },
      select: { rewardAmount: true },
    });
    const alreadyEarnedThisMonth = alreadyVerifiedThisMonth.reduce((sum, s) => sum + Number(s.rewardAmount ?? 0), 0);
    const remainingCap = Math.max(0, monthlyCap - alreadyEarnedThisMonth);
    const rewardAmount = Math.min(rawReward, remainingCap);

    const after = await this.prismaAdmin.programContentSubmission.update({
      where: { id: submissionId },
      data: { status: "verified", rewardAmount, verifiedByAdminUserId: adminUserId, verifiedAt: new Date(), notes: notes ?? null },
    });

    if (rewardAmount > 0) {
      const participant = await this.prismaAdmin.programParticipant.findUniqueOrThrow({ where: { id: submission.participantId } });
      await this.prismaAdmin.ledgerEntry.create({
        data: { sellerId: participant.sellerId, type: "program_reward_credit", amount: rewardAmount, currency: "PKR" },
      });
    }

    await this.auditLog.record({
      adminUserId,
      action: "growth_programs.content_verified",
      targetType: "program_content_submission",
      targetId: submissionId,
      beforeValue: { status: "pending" },
      afterValue: { status: "verified", rewardAmount },
    });
    return after;
  }

  async reject(adminUserId: string, submissionId: string, notes: string | undefined): Promise<ProgramContentSubmission> {
    await this.requirePendingSubmission(submissionId);
    const after = await this.prismaAdmin.programContentSubmission.update({
      where: { id: submissionId },
      data: { status: "rejected", verifiedByAdminUserId: adminUserId, verifiedAt: new Date(), notes: notes ?? null },
    });
    await this.auditLog.record({
      adminUserId,
      action: "growth_programs.content_rejected",
      targetType: "program_content_submission",
      targetId: submissionId,
      beforeValue: { status: "pending" },
      afterValue: { status: "rejected" },
    });
    return after;
  }

  private async requirePendingSubmission(submissionId: string): Promise<ProgramContentSubmission> {
    const submission = await this.prismaAdmin.programContentSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException("Content submission not found.");
    if (submission.status !== "pending") throw new BadRequestException("This submission has already been decided.");
    return submission;
  }
}
