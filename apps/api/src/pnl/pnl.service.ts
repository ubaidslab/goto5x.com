import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { aggregatePeriodProfit, computeOrderProfit, OrderProfitResult } from "./pnl.util";

/**
 * Financial Truth Invariant (§3.12) - the same status set Module 30 gates
 * WhatsApp order-confirmation links on; a `pending`/`awaiting-verification`
 * order contributes exactly nothing to any P&L figure (FR-42.4).
 */
const CONFIRMED_OR_BEYOND = ["confirmed", "shipped", "delivered", "completed"];

type OrderWithItemsForProfit = Prisma.OrderGetPayload<{
  include: { items: { include: { variant: true } } };
}>;

/**
 * SRS §5.42/FR-42.1-42.7 (Module 31) - the Automated Profit & Loss Engine.
 * Reuses Order/OrderItem/ProductVariant/LedgerEntry as-is; the only new
 * data is the cost inputs (ProductVariant.baseCost, Order.courierCost/
 * handlingCost, AdSpendEntry) added by this module's migration. Never a
 * second source of truth for revenue or commission - both come from the
 * exact rows CheckoutService/LedgerService already write.
 */
@Injectable()
export class PnLService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private async commissionByOrderId(tx: Prisma.TransactionClient, orderIds: string[]): Promise<Map<string, number>> {
    if (orderIds.length === 0) return new Map();
    const grouped = await tx.ledgerEntry.groupBy({
      by: ["orderId"],
      // Module 53 (FR-60.4) - refund_adjustment included for consistency
      // with every other commission-summing call site, though in practice a
      // refunded/partially_refunded order never reaches this query at all
      // (CONFIRMED_OR_BEYOND above excludes both statuses outright - the
      // Financial Truth Invariant's "one signal, applied uniformly").
      where: { orderId: { in: orderIds }, type: { in: ["commission_accrued", "commission_waived", "refund_adjustment"] } },
      _sum: { amount: true },
    });
    return new Map(grouped.filter((g) => g.orderId !== null).map((g) => [g.orderId as string, Number(g._sum.amount ?? 0)]));
  }

  private profitForOrder(order: OrderWithItemsForProfit, commissionAmount: number): OrderProfitResult {
    return computeOrderProfit({
      totalAmount: Number(order.totalAmount),
      taxAmount: Number(order.taxAmount),
      commissionAmount,
      courierCost: order.courierCost !== null ? Number(order.courierCost) : null,
      handlingCost: order.handlingCost !== null ? Number(order.handlingCost) : null,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        baseCost: item.variant.baseCost !== null ? Number(item.variant.baseCost) : null,
      })),
    });
  }

  /** FR-42.2/FR-42.4 - a single order's true net profit; throws if the order isn't confirmed+ yet (nothing to compute against the Financial Truth Invariant). */
  async getOrderProfit(sellerId: string, storeId: string, orderId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { variant: true } } } });
      if (!order || order.storeId !== storeId) throw new NotFoundException("Order not found.");
      if (!CONFIRMED_OR_BEYOND.includes(order.status)) {
        throw new BadRequestException("This order isn't confirmed yet - no profit figure exists for an unconfirmed order.");
      }
      const commissionByOrderId = await this.commissionByOrderId(tx, [orderId]);
      return { orderId, ...this.profitForOrder(order, commissionByOrderId.get(orderId) ?? 0) };
    });
  }

  /** FR-42.3/FR-42.4 - every confirmed+ order placed within [periodStart, periodEnd], summed, minus ad-spend entries whose period overlaps the range. */
  async getPeriodProfit(sellerId: string, storeId: string, periodStart: string, periodEnd: string) {
    const start = new Date(periodStart);
    const endInclusive = new Date(periodEnd);
    const endExclusive = new Date(periodEnd);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1); // periodEnd is inclusive on input

    return this.tenantPrisma.run(sellerId, async (tx) => {
      const orders = await tx.order.findMany({
        where: { storeId, status: { in: CONFIRMED_OR_BEYOND as never }, placedAt: { gte: start, lt: endExclusive } },
        include: { items: { include: { variant: true } } },
      });
      const commissionByOrderId = await this.commissionByOrderId(
        tx,
        orders.map((o) => o.id),
      );
      const perOrder = orders.map((order) => this.profitForOrder(order, commissionByOrderId.get(order.id) ?? 0));

      // FR-42.3 - overlap, not containment: an ad-spend entry that only
      // partially overlaps the requested range is still counted in full
      // (v1.0 doesn't pro-rate spend across a split period).
      const adSpendEntries = await tx.adSpendEntry.findMany({
        where: { storeId, periodStart: { lte: endInclusive }, periodEnd: { gte: start } },
      });
      const adSpendTotal = adSpendEntries.reduce((sum, e) => sum + Number(e.amount), 0);

      return { periodStart, periodEnd, ...aggregatePeriodProfit({ orders: perOrder, adSpendTotal }) };
    });
  }

  async listAdSpendEntries(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) =>
      tx.adSpendEntry.findMany({ where: { storeId }, orderBy: { periodStart: "desc" } }),
    );
  }

  async createAdSpendEntry(
    sellerId: string,
    storeId: string,
    dto: { periodStart: string; periodEnd: string; amount: number; note?: string },
  ) {
    if (dto.periodEnd < dto.periodStart) {
      throw new BadRequestException("periodEnd cannot be before periodStart.");
    }
    return this.tenantPrisma.run(sellerId, async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException("Store not found.");
      return tx.adSpendEntry.create({
        data: {
          storeId,
          periodStart: new Date(dto.periodStart),
          periodEnd: new Date(dto.periodEnd),
          amount: dto.amount,
          source: "manual",
          note: dto.note ?? null,
        },
      });
    });
  }
}
