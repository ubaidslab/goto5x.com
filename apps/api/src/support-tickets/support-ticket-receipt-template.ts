import { escapeHtml } from "../invoices/invoice-template";

export interface SupportTicketReceiptData {
  storeName: string;
  ticketId: string;
  subject: string;
  createdAt: Date;
  slaDeadline: Date;
}

/**
 * SRS §5.6k/FR-8.20 (Module 99) - a downloadable confirmation that a
 * support ticket was raised, reusing the same HTML/CSS string-builder
 * style (and the `escapeHtml` helper) as `renderInvoiceHtml`/
 * `renderSubscriptionInvoiceHtml`, rendered through the same Playwright
 * HTML->PDF pipeline (InvoicePdfService.renderToBuffer) - no new PDF
 * engine.
 */
export function renderSupportTicketReceiptHtml(data: SupportTicketReceiptData): string {
  const dateTimeFmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16) + " UTC";

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
  .field { margin-top: 24px; font-size: 14px; }
  .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #777; }
  .field-value { margin-top: 2px; }
  .footnote { margin-top: 32px; font-size: 11px; color: #777; }
</style>
</head>
<body>
  <div class="header">
    <div class="store-name">${escapeHtml(data.storeName)}</div>
    <h1>Support Ticket Receipt</h1>
    <div class="meta">Submitted ${dateTimeFmt(data.createdAt)}</div>
  </div>
  <div class="field">
    <div class="field-label">Ticket ID</div>
    <div class="field-value">${escapeHtml(data.ticketId)}</div>
  </div>
  <div class="field">
    <div class="field-label">Subject</div>
    <div class="field-value">${escapeHtml(data.subject)}</div>
  </div>
  <div class="field">
    <div class="field-label">Response-time commitment</div>
    <div class="field-value">By ${dateTimeFmt(data.slaDeadline)}</div>
  </div>
  <p class="footnote">
    This confirms your support request was received. You can view its status and reply at any time from support.uzeyn.com.
  </p>
</body>
</html>`;
}
