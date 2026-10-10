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
 * it, but is no longer consulted here).
 *
 * B2 (founder decision, 2026-10-10, D9/D10) - the locked multipliers:
 * `quarterly` 2.79x (3mo at -7%), `sixMonth` 5.28x (6mo at -12%, plus 15
 * bonus days of service handled by addInterval()/addMonthsClamped(), not
 * a price adjustment), `yearly` 9x (12mo at -25%). D10's own table is
 * explicit that "every figure [is] rounded to the nearest whole dollar"
 * - 24 x 2.79 is 66.96, not the table's $67, so this rounds to the
 * nearest integer (Math.round), NOT the pre-existing round2() 2-decimal-
 * place convention (caught by the locked-table unit test actually
 * failing against round2() during B2 - a real bug, not a style choice).
 * Round only happens again when a caller derives a PER-MONTH figure from
 * this total (see computeMonthlyEquivalentPrice() below), per the
 * founder's own "round only for display" instruction.
 */
export function computeCyclePrice(
  activeMonthlyPrice: number,
  interval: "monthly" | "quarterly" | "six_month" | "yearly",
  multipliers: { quarterly: number; sixMonth: number; yearly: number },
): number {
  if (interval === "quarterly") return Math.round(activeMonthlyPrice * multipliers.quarterly);
  if (interval === "six_month") return Math.round(activeMonthlyPrice * multipliers.sixMonth);
  if (interval === "yearly") return Math.round(activeMonthlyPrice * multipliers.yearly);
  return round2(activeMonthlyPrice);
}

/**
 * B2 (founder decision, 2026-10-10) - "price per month = total / months of
 * service," rounded only when actually displayed, never here. `six_month`
 * is 6.5 months of service (6 calendar months + 15 bonus days, D10) -
 * every other cycle is its own whole-number month count.
 */
export function monthsOfService(interval: "monthly" | "quarterly" | "six_month" | "yearly"): number {
  if (interval === "quarterly") return 3;
  if (interval === "six_month") return 6.5;
  if (interval === "yearly") return 12;
  return 1;
}

/** B2 - the per-month equivalent of a cycle's total price, unrounded (see monthsOfService()'s own note on rounding). */
export function computeMonthlyEquivalentPrice(cycleTotal: number, interval: "monthly" | "quarterly" | "six_month" | "yearly"): number {
  return cycleTotal / monthsOfService(interval);
}

/**
 * B2 (founder decision, 2026-10-10) - calendar-month arithmetic that
 * CLAMPS to the target month's real last day instead of JS Date's native
 * rollover (e.g. Jan 31 + 1 month would otherwise silently become Mar 3,
 * skipping past Feb entirely - a real latent bug in the billing-cycle
 * math this function replaces, caught while adding the test coverage the
 * founder asked for on month-end edge cases). Time-of-day is preserved
 * from `from`.
 */
export function addMonthsClamped(from: Date, months: number): Date {
  const targetMonthIndex = from.getUTCMonth() + months;
  const year = from.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(from.getUTCDate(), daysInTargetMonth);
  const next = new Date(from);
  next.setUTCFullYear(year, month, day);
  return next;
}
