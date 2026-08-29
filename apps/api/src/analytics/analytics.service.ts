import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma, ReturnRequestStatus } from "@prisma/client";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import {
  bucketSalesOverTime,
  computeAOV,
  computeBestSalesTimes,
  computeRepeatCustomerRate,
  computeReturnRate,
  computeReturnRateByProduct,
  computeTopProducts,
  SalesBucket,
} from "./analytics.util";

/**
 * SRS §5.61/FR-61.1-61.7 (Module 54) - Analytics Depth, seller-facing.
 * Every query here filters to CONFIRMED_OR_BEYOND orders (FR-61.7) - the
 * same Financial Truth Invariant gate PnLService already applies, kept as
 * a local constant per that file's own precedent (no shared constants
 * module for this exists yet). Typed against the real Prisma enums here
 * (unlike analytics.util.ts's plain-string copy, kept dependency-free for
 * pure-function testability).
 */
const CONFIRMED_OR_BEYOND: OrderStatus[] = ["confirmed", "shipped", "delivered", "completed"];
const RETURNED_STATUSES: ReturnRequestStatus[] = ["approved", "completed"];
/**
 * Return-rate denominator only: a completed return moves Order.status to
 * refunded/partially_refunded (Module 53), which CONFIRMED_OR_BEYOND
 * deliberately excludes (it's no longer counted as revenue - PnLService
 * does the same). But a return-rate calculation needs the opposite
 * inclusion: an order that WAS confirmed and later got returned must still
 * count in the "how many of my real sales came back" denominator, or every
 * return would shrink its own denominator and inflate the rate.
 */
const RETURN_ELIGIBLE_STATUSES: OrderStatus[] = ["confirmed", "shipped", "delivered", "completed", "refunded", "partially_refunded"];

@Injectable()
export class AnalyticsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private async assertStoreExists(tx: Prisma.TransactionClient, storeId: string) {
    const store = await tx.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException("Store not found.");
  }

  /** FR-61.1 - top products by revenue or units. */
  async getTopProducts(sellerId: string, storeId: string, by: "revenue" | "units", limit: number) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      await this.assertStoreExists(tx, storeId);
      const items = await tx.orderItem.findMany({
        where: { storeId, order: { status: { in: CONFIRMED_OR_BEYOND } } },
        include: { product: { select: { title: true } } },
      });
      return computeTopProducts(
        items.map((i) => ({ productId: i.productId, productTitle: i.product.title, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
        by,
        limit,
      );
    });
  }

  /** FR-61.2 - sales over time, day/week/month, always Financial-Truth-filtered. */
  async getSalesOverTime(sellerId: string, storeId: string, bucket: SalesBucket, start: Date, end: Date) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      await this.assertStoreExists(tx, storeId);
      const orders = await tx.order.findMany({
        where: { storeId, status: { in: CONFIRMED_OR_BEYOND }, placedAt: { gte: start, lte: end } },
        select: { placedAt: true, totalAmount: true },
      });
      return bucketSalesOverTime(
        orders.map((o) => ({ placedAt: o.placedAt, totalAmount: Number(o.totalAmount) })),
        bucket,
        start,
        end,
      );
    });
  }

  /** FR-61.3/61.4/61.5 - the stat-tile summary: repeat-customer rate, overall return rate, AOV, best sales day/hour. */
  async getOverview(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      await this.assertStoreExists(tx, storeId);

      const [customers, confirmedOrders, returnEligibleOrderCount, returnedOrderCount] = await Promise.all([
        tx.customer.findMany({ where: { storeId }, select: { ordersCount: true } }),
        tx.order.findMany({
          where: { storeId, status: { in: CONFIRMED_OR_BEYOND } },
          select: { placedAt: true, totalAmount: true },
        }),
        tx.order.count({ where: { storeId, status: { in: RETURN_ELIGIBLE_STATUSES } } }),
        tx.returnRequest.count({ where: { storeId, status: { in: RETURNED_STATUSES } } }),
      ]);

      const repeatCustomerRate = computeRepeatCustomerRate(
        customers.length,
        customers.filter((c) => c.ordersCount >= 2).length,
      );
      const returnRate = computeReturnRate(returnEligibleOrderCount, returnedOrderCount);
      const aov = computeAOV(confirmedOrders.map((o) => ({ totalAmount: Number(o.totalAmount) })));
      const bestSalesTimes = computeBestSalesTimes(
        confirmedOrders.map((o) => ({ placedAt: o.placedAt, totalAmount: Number(o.totalAmount) })),
      );

      return { repeatCustomerRate, returnRate, aov, ...bestSalesTimes };
    });
  }

  /** FR-61.4 - return rate per product, order-level attribution (see analytics.util.ts's computeReturnRateByProduct doc comment). */
  async getReturnRateByProduct(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      await this.assertStoreExists(tx, storeId);

      const [items, returnedOrders] = await Promise.all([
        tx.orderItem.findMany({
          where: { storeId, order: { status: { in: RETURN_ELIGIBLE_STATUSES } } },
          include: { product: { select: { title: true } } },
        }),
        tx.returnRequest.findMany({
          where: { storeId, status: { in: RETURNED_STATUSES } },
          select: { orderId: true },
        }),
      ]);

      return computeReturnRateByProduct(
        items.map((i) => ({ productId: i.productId, productTitle: i.product.title, orderId: i.orderId })),
        new Set(returnedOrders.map((r) => r.orderId)),
      );
    });
  }

  /** SRS §5.67/FR-67.5 (Module 91) - orders/revenue/units per deal, same CONFIRMED_OR_BEYOND Financial Truth Invariant gate as every other card here. */
  async getDealPerformance(sellerId: string, storeId: string) {
    return this.tenantPrisma.run(sellerId, async (tx) => {
      await this.assertStoreExists(tx, storeId);

      const [orders, deals] = await Promise.all([
        tx.order.findMany({
          where: { storeId, dealId: { not: null }, status: { in: CONFIRMED_OR_BEYOND } },
          select: { dealId: true, totalAmount: true, items: { select: { quantity: true } } },
        }),
        tx.deal.findMany({ where: { storeId }, select: { id: true, title: true } }),
      ]);

      const titleById = new Map(deals.map((d) => [d.id, d.title]));
      const byDeal = new Map<string, { dealId: string; title: string; orders: number; revenue: number; units: number }>();
      for (const order of orders) {
        const dealId = order.dealId as string;
        const entry = byDeal.get(dealId) ?? {
          dealId,
          title: titleById.get(dealId) ?? "Deleted deal",
          orders: 0,
          revenue: 0,
          units: 0,
        };
        entry.orders += 1;
        entry.revenue += Number(order.totalAmount);
        entry.units += order.items.reduce((sum, item) => sum + item.quantity, 0);
        byDeal.set(dealId, entry);
      }

      return [...byDeal.values()].sort((a, b) => b.revenue - a.revenue);
    });
  }
}
