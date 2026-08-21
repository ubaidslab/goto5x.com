import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * SRS §5.47/FR-47.2, FR-47.3 (Module 47, milestone-celebrations slice
 * only). "Only confirmed+ orders count toward any milestone threshold" -
 * the same Financial Truth Invariant gate every analytics/P&L computation
 * already applies, kept as a local constant per this codebase's own
 * established precedent (no shared constants module for this exists yet).
 */
const CONFIRMED_OR_BEYOND: OrderStatus[] = ["confirmed", "shipped", "delivered", "completed"];

const RECENT_WINDOW_DAYS = 3;

export interface RecentMilestone {
  id: string;
  metric: "order_count" | "sales_amount";
  threshold: number;
  reachedAt: Date;
}

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Called (non-blocking, best-effort - never allowed to affect the
   * payment confirmation it follows) right after an order is confirmed.
   * Recomputes the store's lifetime confirmed order count/revenue and
   * inserts a MilestoneEvent for every threshold just crossed. The
   * `@@unique([storeId, metric, threshold])` constraint - not this
   * function's own "crossed from below to at/above" check - is what
   * actually guarantees "fires exactly once" under concurrent qualifying
   * orders (FR-47.3): two orders confirming in overlapping transactions
   * can both compute "count now covers threshold N", but only one INSERT
   * for (storeId, metric, N) can ever succeed; the loser's P2002 is caught
   * and silently ignored below.
   */
  async checkAndEmit(sellerId: string, storeId: string): Promise<void> {
    try {
      const [orderCountThresholds, salesAmountThresholds] = await Promise.all([
        this.settings.resolve<number[]>("milestones.order_count_thresholds"),
        this.settings.resolve<number[]>("milestones.sales_amount_thresholds"),
      ]);

      await this.tenantPrisma.run(sellerId, async (tx) => {
        const confirmedOrders = await tx.order.findMany({
          where: { storeId, status: { in: CONFIRMED_OR_BEYOND } },
          select: { totalAmount: true },
        });
        const orderCount = confirmedOrders.length;
        const revenue = confirmedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

        const crossedOrderThresholds = orderCountThresholds.filter((t) => orderCount >= t);
        const crossedRevenueThresholds = salesAmountThresholds.filter((t) => revenue >= t);

        for (const threshold of crossedOrderThresholds) {
          await this.tryInsert(tx, storeId, "order_count", threshold);
        }
        for (const threshold of crossedRevenueThresholds) {
          await this.tryInsert(tx, storeId, "sales_amount", threshold);
        }
      });
    } catch (err) {
      this.logger.error(
        `Failed to check/emit milestone events for store ${storeId} - the order confirmation this followed is unaffected.`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async tryInsert(
    tx: Prisma.TransactionClient,
    storeId: string,
    metric: "order_count" | "sales_amount",
    threshold: number,
  ): Promise<void> {
    try {
      await tx.milestoneEvent.create({ data: { storeId, metric, threshold } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return; // Already celebrated - exactly the "fires once" guarantee this is here for.
      }
      throw err;
    }
  }

  /**
   * The dashboard banner's read side. Only a milestone reached recently is
   * returned - an old one a seller already saw and whose localStorage
   * dismissal got cleared (private browsing, a new device) should not
   * resurrect itself indefinitely. Wrapped in `{ milestone }` rather than
   * returned bare - a bare `null` handler return serializes as a truly
   * empty HTTP body (no Content-Type, Content-Length 0) under Nest's
   * Express adapter, not literal JSON "null" - caught by curling the
   * endpoint directly, not assumed.
   */
  async getRecent(sellerId: string, storeId: string): Promise<{ milestone: RecentMilestone | null }> {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");

      const cutoff = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const event = await tx.milestoneEvent.findFirst({
        where: { storeId, reachedAt: { gte: cutoff } },
        orderBy: { reachedAt: "desc" },
      });
      if (!event) return { milestone: null };
      return { milestone: { id: event.id, metric: event.metric, threshold: Number(event.threshold), reachedAt: event.reachedAt } };
    });
  }
}
