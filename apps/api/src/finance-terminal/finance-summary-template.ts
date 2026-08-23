import { escapeHtml, money } from "../invoices/invoice-template";

export interface FinanceSummaryData {
  generatedAt: Date;
  currency: string;
  mrr: number;
  activeSubscriptionCount: number;
  realizedRevenueThisMonth: number;
  realizedRevenueThisQuarter: number;
  arps: number;
  churnRatePercent: number;
  totalRefunded: number;
  refundCount: number;
  growthProgramObligations: { programType: string; outstandingAmount: number; count: number }[];
  totalOutstandingObligations: number;
}

/** Item 7 - reuses InvoicePdfService's Playwright renderer, same plain HTML/CSS string-builder style as renderExportSummaryHtml. */
export function renderFinanceSummaryHtml(data: FinanceSummaryData): string {
  const rows = data.growthProgramObligations
    .map((p) => `<tr><td>${escapeHtml(p.programType)}</td><td class="num">${p.count}</td><td class="num">${money(p.outstandingAmount, data.currency)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 48px; }
  .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 24px; margin-bottom: 32px; }
  h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin: 0; }
  .meta { color: #555; font-size: 13px; margin-top: 4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 32px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  tbody td { padding: 10px 4px; border-bottom: 1px solid #eee; }
  .num { text-align: right; }
  .footnote { margin-top: 32px; font-size: 11px; color: #777; }
</style>
</head>
<body>
  <div class="header">
    <h1>Finance Terminal Summary</h1>
    <div class="meta">Generated ${data.generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC</div>
  </div>

  <h2>Revenue</h2>
  <table>
    <tbody>
      <tr><td>MRR</td><td class="num">${money(data.mrr, data.currency)}</td></tr>
      <tr><td>Active subscriptions</td><td class="num">${data.activeSubscriptionCount}</td></tr>
      <tr><td>Realized revenue this month</td><td class="num">${money(data.realizedRevenueThisMonth, data.currency)}</td></tr>
      <tr><td>Realized revenue this quarter</td><td class="num">${money(data.realizedRevenueThisQuarter, data.currency)}</td></tr>
      <tr><td>ARPS</td><td class="num">${money(data.arps, data.currency)}</td></tr>
      <tr><td>Churn rate</td><td class="num">${data.churnRatePercent}%</td></tr>
    </tbody>
  </table>

  <h2>Refunds</h2>
  <table>
    <tbody>
      <tr><td>Total refunded</td><td class="num">${money(data.totalRefunded, data.currency)}</td></tr>
      <tr><td>Refund count</td><td class="num">${data.refundCount}</td></tr>
    </tbody>
  </table>

  <h2>Growth-program obligations (outstanding)</h2>
  <table>
    <thead><tr><td>Program</td><td class="num">Count</td><td class="num">Amount</td></tr></thead>
    <tbody>
      ${rows}
      <tr><td><strong>Total</strong></td><td></td><td class="num"><strong>${money(data.totalOutstandingObligations, data.currency)}</strong></td></tr>
    </tbody>
  </table>

  <p class="footnote">
    Realized revenue figures are sums of verified plan-fee payments within each calendar period. Growth-program
    obligations reflect requested/approved/processing withdrawal requests not yet paid.
  </p>
</body>
</html>`;
}
