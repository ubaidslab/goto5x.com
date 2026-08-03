import { round2 } from "../orders/money.util";

export interface OrderProfitItemInput {
  quantity: number;
  /** null when never entered - triggers `incomplete`, never treated as 0 (FR-42.1/42.2). */
  baseCost: number | null;
}

export interface OrderProfitInput {
  /**
   * Order.totalAmount is already net of Order.discountAmount
   * (computeOrderTotals() subtracts it before shipping/tax are added), so
   * this formula deliberately does NOT subtract discountAmount a second
   * time - doing so would double-count the discount and understate true
   * revenue. (This corrects an earlier draft of FR-42.2's formula text,
   * written before this was cross-checked against computeOrderTotals()'s
   * actual behavior - see the Module 31 CHANGELOG entry.)
   */
  totalAmount: number;
  taxAmount: number;
  /** Sum of this order's commission_accrued + commission_waived LedgerEntry amounts - never recomputed a second way (FR-42.2). */
  commissionAmount: number;
  courierCost: number | null;
  handlingCost: number | null;
  items: OrderProfitItemInput[];
}

export interface OrderProfitResult {
  revenue: number;
  commission: number;
  cogs: number;
  courierCost: number;
  handlingCost: number;
  netProfit: number;
  /** True if any item's variant has no baseCost entered - the UI must render this order's profit as flagged/incomplete, never a number that silently excludes that cost (FR-42.1/42.2). */
  incomplete: boolean;
}

export function computeOrderProfit(input: OrderProfitInput): OrderProfitResult {
  const revenue = round2(input.totalAmount - input.taxAmount);
  const commission = round2(input.commissionAmount);
  const courierCost = round2(input.courierCost ?? 0);
  const handlingCost = round2(input.handlingCost ?? 0);
  const incomplete = input.items.some((item) => item.baseCost === null);
  const cogs = round2(input.items.reduce((sum, item) => sum + (item.baseCost ?? 0) * item.quantity, 0));
  const netProfit = round2(revenue - commission - cogs - courierCost - handlingCost);
  return { revenue, commission, cogs, courierCost, handlingCost, netProfit, incomplete };
}

export interface PeriodProfitInput {
  orders: OrderProfitResult[];
  /** Only ad-spend entries whose period overlaps the requested range (FR-42.3) - the caller filters, this just sums. */
  adSpendTotal: number;
}

export interface PeriodProfitResult {
  orderCount: number;
  revenue: number;
  commission: number;
  cogs: number;
  courierCost: number;
  handlingCost: number;
  adSpend: number;
  netProfit: number;
  /** True if any included order is individually incomplete - the period total is then itself a floor, not an exact figure. */
  incomplete: boolean;
}

export function aggregatePeriodProfit(input: PeriodProfitInput): PeriodProfitResult {
  const revenue = round2(input.orders.reduce((sum, o) => sum + o.revenue, 0));
  const commission = round2(input.orders.reduce((sum, o) => sum + o.commission, 0));
  const cogs = round2(input.orders.reduce((sum, o) => sum + o.cogs, 0));
  const courierCost = round2(input.orders.reduce((sum, o) => sum + o.courierCost, 0));
  const handlingCost = round2(input.orders.reduce((sum, o) => sum + o.handlingCost, 0));
  const adSpend = round2(input.adSpendTotal);
  const netProfit = round2(revenue - commission - cogs - courierCost - handlingCost - adSpend);
  return {
    orderCount: input.orders.length,
    revenue,
    commission,
    cogs,
    courierCost,
    handlingCost,
    adSpend,
    netProfit,
    incomplete: input.orders.some((o) => o.incomplete),
  };
}
