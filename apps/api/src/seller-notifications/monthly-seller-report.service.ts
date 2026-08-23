import { Injectable, Logger } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { EmailService } from "../notifications/email.service";

const CONFIRMED_OR_BEYOND: OrderStatus[] = ["confirmed", "shipped", "delivered", "completed"];

/**
 * SRS §5.6k/FR-6.47 (Module 70a) - the monthly summary email, same
 * unconditional/no-opt-out discipline as Module 55's own
 * `sendDailySalesSummaryEmail` (see the SRS's own correction of §5.6i's
 * original text, which wrongly claimed a general opt-out applies here).
 * Same "compute the natural period fresh each run, no sticky per-seller
 * flag" idiom as the daily sweep - this one only ever actually sends on
 * the 1st of the calendar month (UTC), for the month that just ended, so
 * the scheduler can check far more often than that without risking a
 * duplicate send.
 */
@Injectable()
export class MonthlySellerReportService {
  private readonly logger = new Logger(MonthlySellerReportService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly email: EmailService,
  ) {}

  async runSweep(now = new Date()): Promise<{ emailsSent: number }> {
    if (now.getUTCDate() !== 1) return { emailsSent: 0 };

    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthLabel = periodStart.toISOString().slice(0, 7);

    const sellers = await this.prismaAdmin.seller.findMany({
      include: { user: { select: { email: true } }, stores: { select: { id: true, currency: true } } },
    });

    let emailsSent = 0;
    for (const seller of sellers) {
      try {
        const storeIds = seller.stores.map((s) => s.id);
        if (storeIds.length === 0) continue;

        const [orders, planFeePayments] = await Promise.all([
          this.prismaAdmin.order.findMany({
            where: { storeId: { in: storeIds }, status: { in: CONFIRMED_OR_BEYOND }, placedAt: { gte: periodStart, lt: periodEnd } },
            select: { totalAmount: true },
          }),
          this.prismaAdmin.walletTopUpRequest.findMany({
            where: {
              ownerType: "seller",
              ownerId: seller.id,
              status: "verified",
              planFeePortion: { not: null },
              verifiedAt: { gte: periodStart, lt: periodEnd },
            },
            select: { planFeePortion: true },
          }),
        ]);
        if (orders.length === 0 && planFeePayments.length === 0) continue; // nothing to report

        const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const subscriptionPaid = planFeePayments.reduce((sum, p) => sum + Number(p.planFeePortion), 0);
        const currency = seller.stores[0]?.currency ?? "PKR";

        await this.email.sendMonthlySellerReportEmail(seller.user.email, monthLabel, orders.length, revenue, subscriptionPaid, currency);
        emailsSent += 1;
      } catch (err) {
        this.logger.warn(`monthly-seller-report failed for seller ${seller.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { emailsSent };
  }
}
