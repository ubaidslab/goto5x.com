import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TrustSafetyMonitorsService } from "../trust-safety/trust-safety-monitors.service";
import { PaymentReviewQueueService } from "../trust-safety/payment-review-queue.service";
import { UnitEconomicsService } from "../guardrails/unit-economics.service";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface QueueCount {
  label: string;
  count: number;
  /** Web app route this count jump-links to. */
  href: string;
}

/**
 * Module 25 (Admin Completion) - the admin HOME page's data source. No new
 * domain logic beyond "today" filtering and a queue-count fan-out: GMV/
 * revenue reuse UnitEconomicsService.computeRealTimeAnalytics() as-is
 * (FR-8.10, already built Module 17) rather than a second analytics engine.
 * Every count below mirrors the exact "pending" filter its own admin queue
 * page already uses - if that page's filter ever changes, this fans out
 * from the same enum values, not a second copy of the business rule.
 */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly monitors: TrustSafetyMonitorsService,
    private readonly paymentReview: PaymentReviewQueueService,
    private readonly unitEconomics: UnitEconomicsService,
  ) {}

  async getOverview() {
    const since = startOfToday();

    const [
      todaySignups,
      todayOrders,
      todayGmv,
      analytics,
      walletTopUpsPending,
      verificationApplicationsPending,
      verificationReReviewFlagged,
      moderationQueue,
      paymentReviewQueue,
      growthProgramApplications,
      growthProgramContentSubmissions,
      growthProgramWithdrawals,
      careerApplicants,
      cancellationRateFlags,
      pendingForeverRateFlags,
      bypassAttemptFlags,
      signupVelocityFlags,
      selfReferralFlags,
    ] = await Promise.all([
      this.prismaAdmin.seller.count({ where: { createdAt: { gte: since } } }),
      this.prismaAdmin.order.count({ where: { placedAt: { gte: since } } }),
      this.prismaAdmin.order.aggregate({
        where: { placedAt: { gte: since }, status: { not: "pending" } },
        _sum: { totalAmount: true },
      }),
      this.unitEconomics.computeRealTimeAnalytics(),
      this.prismaAdmin.walletTopUpRequest.count({ where: { status: "pending" } }),
      this.prismaAdmin.verifiedStoreApplication.count({ where: { status: "pending_review" } }),
      this.prismaAdmin.store.count({ where: { reReviewFlaggedAt: { not: null } } }),
      this.prismaAdmin.product.count({ where: { moderationStatus: "pending" } }),
      this.paymentReview.listQueue(),
      this.prismaAdmin.programParticipant.count({ where: { status: "pending" } }),
      this.prismaAdmin.programContentSubmission.count({ where: { status: "pending" } }),
      this.prismaAdmin.payoutRequest.count({ where: { status: "requested" } }),
      this.prismaAdmin.jobApplication.count({ where: { status: "received" } }),
      this.monitors.cancellationRateFlags(),
      this.monitors.pendingForeverRateFlags(),
      this.monitors.bypassAttemptFlags(),
      this.monitors.signupVelocityFlags(),
      this.monitors.selfReferralFlags(),
    ]);

    const queues: QueueCount[] = [
      { label: "Wallet top-ups pending verification", count: walletTopUpsPending, href: "/admin/invoices" },
      { label: "Verified Store applications", count: verificationApplicationsPending, href: "/admin/verification" },
      { label: "Verified Store re-review flags", count: verificationReReviewFlagged, href: "/admin/verification" },
      { label: "Product moderation queue", count: moderationQueue, href: "/admin/moderation" },
      { label: "Payment-instrument review queue", count: paymentReviewQueue.length, href: "/admin/trust-safety" },
      { label: "Cancellation-rate flags", count: cancellationRateFlags.length, href: "/admin/trust-safety" },
      { label: "Pending-forever-rate flags", count: pendingForeverRateFlags.length, href: "/admin/trust-safety" },
      { label: "Moderation bypass-attempt flags", count: bypassAttemptFlags.length, href: "/admin/trust-safety" },
      { label: "Signup-velocity flags", count: signupVelocityFlags.length, href: "/admin/trust-safety" },
      { label: "Self-referral flags", count: selfReferralFlags.length, href: "/admin/trust-safety" },
      { label: "Growth program applications", count: growthProgramApplications, href: "/admin/growth-programs/applications" },
      { label: "Growth program content submissions", count: growthProgramContentSubmissions, href: "/admin/growth-programs/content-submissions" },
      { label: "Growth program withdrawals", count: growthProgramWithdrawals, href: "/admin/growth-programs/withdrawals" },
      { label: "Career applicants awaiting review", count: careerApplicants, href: "/admin/careers" },
    ];

    return {
      today: {
        signups: todaySignups,
        orders: todayOrders,
        gmv: Number(todayGmv._sum.totalAmount ?? 0),
      },
      allTime: analytics,
      queues,
      pendingActionCount: queues.reduce((sum, q) => sum + q.count, 0),
    };
  }
}
