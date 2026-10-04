/**
 * SRS §5.70/FR-70.5 (Global Launch Mandate) - DECIDED (founder, 2026-10-03):
 * a platform-wide figure that sums amounts across stores/sellers must never
 * blend currencies into one fake-converted number (no FX engine, by design -
 * see FR-70.1). Every admin aggregate that reads real money groups by
 * `currency` and reports one line per currency present instead.
 */
export interface CurrencyAmount {
  currency: string;
  amount: number;
}

/** Shape returned by `prisma.<model>.groupBy({ by: ["currency"], _sum: { <field>: true } })`. */
interface GroupedByCurrency {
  currency: string;
  _sum: Record<string, unknown>;
}

/** Converts a groupBy result into a clean, sorted breakdown - largest amount first, zero-amount currencies dropped. */
export function toCurrencyBreakdown(rows: GroupedByCurrency[], sumField: string): CurrencyAmount[] {
  return rows
    .map((row) => ({ currency: row.currency, amount: Number(row._sum[sumField] ?? 0) }))
    .filter((row) => row.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}
