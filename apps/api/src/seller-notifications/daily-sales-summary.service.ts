import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderStatus } from "@prisma/client";
import { EmailService } from "../notifications/email.service";
import { PrismaAdminService } from "../prisma/prisma-admin.service";

/** Same Financial Truth Invariant filter Module 54's AnalyticsService uses (FR-61.7/FR-62.1). */
const CONFIRMED_OR_BEYOND: OrderStatus[] = ["confirmed", "shipped", "delivered", "completed"];

/**
 * Module 55 (SRS §5.62/FR-62.1) - the daily sales summary sweep. Built on
 * the same status-filtered query idiom Module 54's AnalyticsService
 * established (a single-day sum here, not a bucketed series, so this
 * queries directly rather than calling through AnalyticsService's
 * tenant-scoped, per-seller-token API for what would otherwise be N
 * redundant transactions across every store in one sweep). Only stores
 * with at least one confirmed order yesterday get an email - a store with
 * zero sales doesn't need to be told that.
 */
@Injectable()
export class DailySalesSummaryService {
  private readonly logger = new Logger(DailySalesSummaryService.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async runSweep(): Promise<{ storesProcessed: number; emailsSent: number }> {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const dateLabel = yesterdayStart.toISOString().slice(0, 10);

    const stores = await this.prismaAdmin.store.findMany({ where: { status: { in: ["active", "orders_paused"] } } });

    let emailsSent = 0;
    for (const store of stores) {
      try {
        const orders = await this.prismaAdmin.order.findMany({
          where: { storeId: store.id, status: { in: CONFIRMED_OR_BEYOND }, placedAt: { gte: yesterdayStart, lt: todayStart } },
          select: { totalAmount: true },
        });
        if (orders.length === 0) continue;

        const seller = await this.prismaAdmin.seller.findUnique({ where: { id: store.sellerId }, include: { user: true } });
        if (!seller) continue;

        const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
        await this.email.sendDailySalesSummaryEmail(
          seller.user.email,
          store.name,
          dateLabel,
          orders.length,
          revenue.toFixed(2),
          store.currency,
          `${this.config.getOrThrow<string>("APP_BASE_URL")}/stores/${store.id}/analytics`,
        );
        emailsSent++;
      } catch (err) {
        this.logger.warn(`daily-sales-summary failed for store ${store.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { storesProcessed: stores.length, emailsSent };
  }
}
