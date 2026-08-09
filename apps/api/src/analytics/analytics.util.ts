import { round2 } from "../orders/money.util";

/**
 * SRS §5.61/FR-61.7 - the Financial Truth Invariant applied to analytics:
 * the same "confirmed or beyond" status set PnLService's CONFIRMED_OR_BEYOND
 * gates on. Duplicated locally rather than imported, matching the existing
 * pattern (guardrails/unit-economics.service.ts also keeps its own copy) -
 * there is no shared constants module for this today.
 */
export const CONFIRMED_OR_BEYOND = ["confirmed", "shipped", "delivered", "completed"] as const;

export type SalesBucket = "day" | "week" | "month";

export interface OrderForBucketing {
  placedAt: Date;
  totalAmount: number;
}

export interface SalesBucketPoint {
  /** ISO date string (UTC midnight) marking the start of this bucket. */
  bucketStart: string;
  orderCount: number;
  revenue: number;
}

function bucketKey(date: Date, bucket: SalesBucket): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (bucket === "day") return d.toISOString().slice(0, 10);
  if (bucket === "month") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  // week - Monday-anchored ISO week start.
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  return d.toISOString().slice(0, 10);
}

function stepBucket(key: string, bucket: SalesBucket): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  if (bucket === "day") d.setUTCDate(d.getUTCDate() + 1);
  else if (bucket === "week") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * FR-61.2 - sales over time, day/week/month. Every bucket in [rangeStart,
 * rangeEnd] is present in the output, including zero-order buckets, so a
 * chart never shows a gap where a period had no sales at all.
 */
export function bucketSalesOverTime(
  orders: OrderForBucketing[],
  bucket: SalesBucket,
  rangeStart: Date,
  rangeEnd: Date,
): SalesBucketPoint[] {
  const totals = new Map<string, { orderCount: number; revenue: number }>();
  for (const order of orders) {
    const key = bucketKey(order.placedAt, bucket);
    const existing = totals.get(key) ?? { orderCount: 0, revenue: 0 };
    existing.orderCount += 1;
    existing.revenue = round2(existing.revenue + order.totalAmount);
    totals.set(key, existing);
  }

  const points: SalesBucketPoint[] = [];
  let cursor = bucketKey(rangeStart, bucket);
  const endKey = bucketKey(rangeEnd, bucket);
  // Bounded by construction (rangeEnd is always a real, caller-supplied
  // date - never unbounded), but capped defensively against a caller
  // passing an inverted or absurd range.
  let guard = 0;
  while (guard < 10_000) {
    const entry = totals.get(cursor) ?? { orderCount: 0, revenue: 0 };
    points.push({ bucketStart: cursor, orderCount: entry.orderCount, revenue: entry.revenue });
    if (cursor === endKey) break;
    cursor = stepBucket(cursor, bucket);
    guard += 1;
  }
  return points;
}

export interface OrderItemForTopProducts {
  productId: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
}

export interface TopProductRow {
  productId: string;
  productTitle: string;
  units: number;
  revenue: number;
}

/** FR-61.1 - top products by revenue or units, aggregated in JS over already status-filtered OrderItem rows (mirrors PnLService's fetch-then-compute idiom - Prisma groupBy can't sum a computed quantity*unitPrice). */
export function computeTopProducts(items: OrderItemForTopProducts[], by: "revenue" | "units", limit: number): TopProductRow[] {
  const totals = new Map<string, TopProductRow>();
  for (const item of items) {
    const existing = totals.get(item.productId) ?? {
      productId: item.productId,
      productTitle: item.productTitle,
      units: 0,
      revenue: 0,
    };
    existing.units += item.quantity;
    existing.revenue = round2(existing.revenue + item.quantity * item.unitPrice);
    totals.set(item.productId, existing);
  }
  return Array.from(totals.values())
    .sort((a, b) => (by === "revenue" ? b.revenue - a.revenue : b.units - a.units))
    .slice(0, limit);
}

/** FR-61.3 - repeat-customer rate; 0 (not NaN/divide-by-zero) for a store with no customers yet. */
export function computeRepeatCustomerRate(totalCustomers: number, repeatCustomers: number): number {
  if (totalCustomers === 0) return 0;
  return round2((repeatCustomers / totalCustomers) * 100);
}

/** FR-61.4 - return rate (overall or per-product), same divide-by-zero guard. */
export function computeReturnRate(eligibleOrderCount: number, returnedOrderCount: number): number {
  if (eligibleOrderCount === 0) return 0;
  return round2((returnedOrderCount / eligibleOrderCount) * 100);
}

/** FR-61.5 - average order value; 0 for a store with no confirmed+ orders yet. */
export function computeAOV(orders: { totalAmount: number }[]): number {
  if (orders.length === 0) return 0;
  return round2(orders.reduce((sum, o) => sum + o.totalAmount, 0) / orders.length);
}

export interface BestSalesTimes {
  /** 0 = Sunday ... 6 = Saturday (JS Date convention), or null if there's no order data at all. */
  bestDayOfWeek: number | null;
  /** 0-23 UTC hour, or null if there's no order data at all. */
  bestHourOfDay: number | null;
}

/** FR-61.5 - best sales days/times, ranked by revenue (same metric AOV already reports in), bucketed by day-of-week and hour-of-day across all supplied orders. */
export function computeBestSalesTimes(orders: OrderForBucketing[]): BestSalesTimes {
  if (orders.length === 0) return { bestDayOfWeek: null, bestHourOfDay: null };

  const byDay = new Map<number, number>();
  const byHour = new Map<number, number>();
  for (const order of orders) {
    const day = order.placedAt.getUTCDay();
    const hour = order.placedAt.getUTCHours();
    byDay.set(day, round2((byDay.get(day) ?? 0) + order.totalAmount));
    byHour.set(hour, round2((byHour.get(hour) ?? 0) + order.totalAmount));
  }

  const bestDayOfWeek = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1])[0][0];
  const bestHourOfDay = Array.from(byHour.entries()).sort((a, b) => b[1] - a[1])[0][0];
  return { bestDayOfWeek, bestHourOfDay };
}

export interface ReturnRateByProductRow {
  productId: string;
  productTitle: string;
  returnRate: number;
}

/**
 * FR-61.4 - per-product return rate, attributed at order level: a product
 * counts as "returned" for every order-with-a-return-request it appeared
 * in, regardless of whether that specific return's optional item-level
 * `refundedItems` breakdown names it individually (that field isn't always
 * populated - see returns.service.ts). This matches the FR text's "grouped
 * by the returned order's items' productId" literally, at the coarser
 * order-level granularity the schema actually guarantees.
 */
export function computeReturnRateByProduct(
  eligibleOrderProductPairs: { productId: string; productTitle: string; orderId: string }[],
  returnedOrderIds: Set<string>,
): ReturnRateByProductRow[] {
  const eligibleByProduct = new Map<string, { productTitle: string; orderIds: Set<string> }>();
  for (const row of eligibleOrderProductPairs) {
    const existing = eligibleByProduct.get(row.productId) ?? { productTitle: row.productTitle, orderIds: new Set<string>() };
    existing.orderIds.add(row.orderId);
    eligibleByProduct.set(row.productId, existing);
  }

  return Array.from(eligibleByProduct.entries()).map(([productId, { productTitle, orderIds }]) => {
    const returnedCount = Array.from(orderIds).filter((id) => returnedOrderIds.has(id)).length;
    return { productId, productTitle, returnRate: computeReturnRate(orderIds.size, returnedCount) };
  });
}
