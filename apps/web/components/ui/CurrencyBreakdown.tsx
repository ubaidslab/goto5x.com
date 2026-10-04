interface CurrencyAmount {
  currency: string;
  amount: number;
}

/**
 * SRS §5.70/FR-70.5 (DECIDED, founder 2026-10-03) - a platform-wide money
 * figure that spans multiple stores/sellers renders as one line per
 * currency present, never a blended fake-converted total (no FX engine, by
 * design). "GMV today: PKR 1,240,500 - USD 3,210" is the FR's own example
 * format - this component is that format, shared so every admin tile that
 * reads one of these breakdowns renders it identically.
 */
export function CurrencyBreakdown({ amounts, emptyLabel = "No activity yet" }: { amounts: CurrencyAmount[]; emptyLabel?: string }) {
  if (amounts.length === 0) {
    return <span className="text-ink-faint">{emptyLabel}</span>;
  }
  return <>{amounts.map((a) => `${a.currency} ${a.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(" · ")}</>;
}
