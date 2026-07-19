import { round2 } from "../orders/money.util";

/** FR-7.6 - the yearly price for a monthly-priced tier, at the admin-configured discount off twelve months at the monthly rate. */
export function computeYearlyPrice(monthlyPrice: number, yearlyDiscountPercent: number | null | undefined): number {
  const discount = yearlyDiscountPercent ?? 0;
  return round2(monthlyPrice * 12 * (1 - discount / 100));
}
