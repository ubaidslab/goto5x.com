import { escapeHtml, money } from "../invoices/invoice-template";

export interface ExportSummaryData {
  businessName: string;
  periodStart: Date;
  periodEnd: Date;
  productCount: number;
  orderCount: number;
  customerCount: number;
  totalRevenue: number;
  currency: string;
}

/**
 * Module 24 (SRS §5.36, FR-36.2) - the "one summary PDF" reusing FR-19.1's
 * exact HTML->PDF renderer (InvoicePdfService.generateFromHtml) with a new
 * template, not a new engine. Same plain HTML/CSS string-builder style as
 * `renderInvoiceHtml`.
 */
export function renderExportSummaryHtml(data: ExportSummaryData): string {
  const dateFmt = (d: Date) => d.toISOString().slice(0, 10);
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
  tbody td { padding: 10px 4px; border-bottom: 1px solid #eee; }
  .num { text-align: right; }
  .footnote { margin-top: 32px; font-size: 11px; color: #777; }
</style>
</head>
<body>
  <div class="header">
    <div class="store-name">${escapeHtml(data.businessName)}</div>
    <h1>Data Export Summary</h1>
    <div class="meta">${dateFmt(data.periodStart)} to ${dateFmt(data.periodEnd)}</div>
  </div>
  <table>
    <tbody>
      <tr><td>Products</td><td class="num">${data.productCount}</td></tr>
      <tr><td>Orders</td><td class="num">${data.orderCount}</td></tr>
      <tr><td>Customers</td><td class="num">${data.customerCount}</td></tr>
      <tr><td>Total revenue (orders in this period)</td><td class="num">${money(data.totalRevenue, data.currency)}</td></tr>
    </tbody>
  </table>
  <p class="footnote">
    This export is a convenience copy of your own store data for your own records. It is not a
    substitute for goto5x.com's own automated platform backups, which run regardless of this export.
  </p>
</body>
</html>`;
}
