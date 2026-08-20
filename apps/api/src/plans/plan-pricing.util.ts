import { round2 } from "../orders/money.util";

/** FR-7.6 - the yearly price for a monthly-priced tier, at the admin-configured discount off twelve months at the monthly rate. */
export function computeYearlyPrice(monthlyPrice: number, yearlyDiscountPercent: number | null | undefined): number {
  const discount = yearlyDiscountPercent ?? 0;
  return round2(monthlyPrice * 12 * (1 - discount / 100));
}

/**
 * Module 61 (SRS §5.7, FR-7.20) - the price actually shown/billed for a
 * tier right now: `campaignPrice` while `campaignActive` is true (a
 * time-boxed campaign variant), `price` otherwise. Never `regularPrice`
 * (that stays a pure struck-through reference, FR-7.19) and never
 * `firstCyclePrice` (that's a first-payment-only discount, resolved
 * separately by whoever computes a seller's very first plan-fee payment -
 * see WalletService.getPlanFeePaymentPreview(), Module 73).
 */
export function resolveActivePlanPrice(plan: { price: unknown; campaignPrice: unknown; campaignActive: boolean }): number {
  if (plan.campaignActive && plan.campaignPrice !== null && plan.campaignPrice !== undefined) {
    return round2(Number(plan.campaignPrice));
  }
  return round2(Number(plan.price));
}

/**
 * Module 61 (FR-7.20) - the founder's fixed-multiplier billing-cycle
 * model, replacing FR-7.6's admin-configurable `yearlyDiscountPercent`
 * framing for the pricing page/subscription math (the column itself is
 * left in place, since existing plan-editor tooling still reads/writes
 * it, but is no longer consulted here). `six_month` bills 5.5x the active
 * monthly price for 6 months of service; `yearly` bills 10x for 12 months
 * - both fixed multipliers, not a stored per-cycle price.
 */
export function computeCyclePrice(
  activeMonthlyPrice: number,
  interval: "monthly" | "six_month" | "yearly",
  multipliers: { sixMonth: number; yearly: number },
): number {
  if (interval === "six_month") return round2(activeMonthlyPrice * multipliers.sixMonth);
  if (interval === "yearly") return round2(activeMonthlyPrice * multipliers.yearly);
  return round2(activeMonthlyPrice);
}
