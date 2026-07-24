import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

interface NotificationItem {
  label: string;
  count: number;
  href: string;
}

/**
 * Module 25 P1 - the admin notification center (founder's Module 25
 * commission, item requiring "new/changed rows across every queue since
 * [the admin's last-seen timestamp]"). Deliberately scoped to the
 * row-based admin queues that have a real creation timestamp
 * (wallet top-ups, Verified Store applications, moderation, growth-program
 * applications/content/withdrawals, career applicants) - the T&S monitor
 * views on the HOME overview (admin-overview.service.ts) are live-computed
 * aggregates with no per-row "created since X" concept, so a "new since
 * last seen" diff doesn't apply to them the same way; those stay
 * overview-only counts, unchanged by this module.
 */
@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  async getNotifications(adminUserId: string) {
    const adminUser = await this.prismaAdmin.adminUser.findUniqueOrThrow({ where: { id: adminUserId } });
    const since = adminUser.lastSeenNotificationsAt ?? new Date(0);

    const [
      walletTopUps,
      verifiedStoreApplications,
      moderationSubmissions,
      growthApplications,
      growthContentSubmissions,
      growthWithdrawals,
      careerApplicants,
    ] = await Promise.all([
      this.prismaAdmin.walletTopUpRequest.count({ where: { requestedAt: { gt: since } } }),
      this.prismaAdmin.verifiedStoreApplication.count({ where: { createdAt: { gt: since } } }),
      this.prismaAdmin.product.count({ where: { moderationStatus: "pending", createdAt: { gt: since } } }),
      this.prismaAdmin.programParticipant.count({ where: { appliedAt: { gt: since } } }),
      this.prismaAdmin.programContentSubmission.count({ where: { createdAt: { gt: since } } }),
      this.prismaAdmin.payoutRequest.count({ where: { requestedAt: { gt: since } } }),
      this.prismaAdmin.jobApplication.count({ where: { createdAt: { gt: since } } }),
    ]);

    const items: NotificationItem[] = [
      { label: "New wallet top-up requests", count: walletTopUps, href: "/admin/invoices" },
      { label: "New Verified Store applications", count: verifiedStoreApplications, href: "/admin/verification" },
      { label: "New products awaiting moderation", count: moderationSubmissions, href: "/admin/moderation" },
      { label: "New growth program applications", count: growthApplications, href: "/admin/growth-programs/applications" },
      { label: "New growth program content submissions", count: growthContentSubmissions, href: "/admin/growth-programs/content-submissions" },
      { label: "New growth program withdrawal requests", count: growthWithdrawals, href: "/admin/growth-programs/withdrawals" },
      { label: "New job applicants", count: careerApplicants, href: "/admin/careers" },
    ].filter((item) => item.count > 0);

    return {
      lastSeenAt: adminUser.lastSeenNotificationsAt,
      totalCount: items.reduce((sum, item) => sum + item.count, 0),
      items,
    };
  }

  async markSeen(adminUserId: string): Promise<void> {
    await this.prismaAdmin.adminUser.update({ where: { id: adminUserId }, data: { lastSeenNotificationsAt: new Date() } });
  }
}
