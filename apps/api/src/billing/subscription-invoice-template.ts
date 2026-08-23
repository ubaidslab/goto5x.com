import { escapeHtml, money } from "../invoices/invoice-template";

export interface SubscriptionInvoiceData {
  businessName: string;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  /** One row per verified plan-fee payment (WalletTopUpRequest.planFeePortion) in the period. */
  payments: { paidAt: Date; amount: number }[];
  /** One row per refund_adjustment LedgerEntry in the period - already-negative amounts, shown as a credit. */
  refunds: { creditedAt: Date; amount: number }[];
}

/**
 * SRS §5.6k/FR-6.47 (Module 70) - the seller's own record of what they paid
 * TO THE PLATFORM (plan fee only - commission is 0%, FR-6.51). Distinct
 * from Module 57's buyer-facing order invoices; reuses the same HTML/CSS
 * string-builder style (and the `escapeHtml`/`money` helpers) as
 * `renderInvoiceHtml`/`renderExportSummaryHtml`, rendered through the same
 * Playwright HTML->PDF pipeline (InvoicePdfService.renderToBuffer) - no new
 * PDF engine.
 */
export function renderSubscriptionInvoiceHtml(data: SubscriptionInvoiceData): string {
  const dateFmt = (d: Date) => d.toISOString().slice(0, 10);
  const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = data.refunds.reduce((sum, r) => sum + r.amount, 0); // already negative
  const netTotal = totalPaid + totalRefunded;

  const paymentRows = data.payments
    .map((p) => `<tr><td>Plan-fee payment</td><td>${dateFmt(p.paidAt)}</td><td class="num">${money(p.amount, data.currency)}</td></tr>`)
    .join("");
  const refundRows = data.refunds
    .map((r) => `<tr><td>Cancellation refund</td><td>${dateFmt(r.creditedAt)}</td><td class="num">${money(r.amount, data.currency)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 48px; }
  .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 24px; margin-bottom: 32px; }
  .store-name { font-size: 28px; font-weight: bold; letter-spacing: 0.5px; }
  h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0; }
  .meta { color: #555; font-size: 13px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 24px; }
  thead th { text-align: left; border-bottom: 1px solid #1a1a1a; padding: 8px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  tbody td { padding: 10px 4px; border-bottom: 1px solid #eee; }
  .num { text-align: right; }
  tfoot td { padding: 10px 4px; border: none; }
  .grand-total td { font-weight: bold; font-size: 16px; border-top: 2px solid #1a1a1a; }
  .footnote { margin-top: 32px; font-size: 11px; color: #777; }
</style>
</head>
<body>
  <div class="header">
    <div class="store-name">${escapeHtml(data.businessName)}</div>
    <h1>UZEYN Subscription Invoice</h1>
    <div class="meta">${dateFmt(data.periodStart)} to ${dateFmt(data.periodEnd)}</div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Date</th><th class="num">Amount</th></tr></thead>
    <tbody>${paymentRows}${refundRows}</tbody>
    <tfoot>
      <tr class="grand-total"><td colspan="2">Net total paid to uzeyn.com this period</td><td class="num">${money(netTotal, data.currency)}</td></tr>
    </tfoot>
  </table>
  <p class="footnote">
    This is your own record of what you paid to uzeyn.com for your subscription plan fee this period. Commission is 0% platform-wide - this invoice never includes a commission line. It is distinct from any order invoice given to your buyers.
  </p>
</body>
</html>`;
}
