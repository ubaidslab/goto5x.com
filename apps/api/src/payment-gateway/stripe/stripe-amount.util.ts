/**
 * Stripe represents most amounts in the currency's smallest unit (cents
 * for USD/PKR), except for this fixed, Stripe-documented list of
 * "zero-decimal" currencies, which it represents as whole units already
 * - dividing one of these by 100 would silently misreport an amount at
 * 1/100th its real value, exactly the "Financial Truth Invariant" class
 * of bug this codebase treats as a real-money defect, not a rounding
 * nuance. Stripe's SDK has no built-in helper for this - every
 * integrator maintains this list themselves.
 */
const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/** Converts a Stripe amount (its own smallest-unit representation) into a normal decimal amount in the given currency. */
export function stripeAmountToDecimal(amount: number, currency: string): number {
  return STRIPE_ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? amount : amount / 100;
}
