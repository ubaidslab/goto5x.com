export interface InvoiceLineItem {
  title: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  orderId: string;
  storeId: string;
  storeName: string;
  /** FR-32.5 - null when no logo is set; the header falls back to the typographic mark below. */
  logoUrl?: string | null;
  currency: string;
  placedAt: Date;
  buyerName: string;
  buyerEmail: string;
  items: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  taxLabel: string;
  taxInclusive: boolean;
  totalAmount: number;
  /**
   * Module 57 (SRS §5.64/FR-64.1/64.2) - all optional, seller-controlled,
   * each rendered only when set (never a blank placeholder when absent).
   * `businessName` is `Seller.businessName`, distinct from `storeName`
   * above (the store's own display name).
   */
  businessName?: string | null;
  taxNumber?: string | null;
  invoiceFooterText?: string | null;
  invoiceTermsText?: string | null;
}

export function money(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * FR-19.1/19.2 - the platform's one v1.0 invoice template ("clean and
 * professional, not generic", single founder sign-off, §14.19). FR-32.5
 * (Module 15.5) - the header shows the seller's uploaded logo when set;
 * with none set, falls back to the store name in the same designed
 * typographic mark Module 15 shipped.
 */
export function renderInvoiceHtml(data: InvoiceData): string {
  const rows = data.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${money(item.unitPrice, data.currency)}</td>
          <td class="num">${money(item.unitPrice * item.quantity, data.currency)}</td>
        </tr>`,
    )
    .join("");

  const taxLine = data.taxInclusive
    ? `<tr><td colspan="3">${escapeHtml(data.taxLabel)} (included in prices shown)</td><td class="num">${money(data.taxAmount, data.currency)}</td></tr>`
    : `<tr><td colspan="3">${escapeHtml(data.taxLabel)}</td><td class="num">${money(data.taxAmount, data.currency)}</td></tr>`;

  // FR-64.1/64.2 - each line renders only when the seller has actually set
  // it; nothing appears as a blank placeholder for an unset field.
  const soldByLines = [
    data.businessName ? escapeHtml(data.businessName) : null,
    data.taxNumber ? `Tax/NTN: ${escapeHtml(data.taxNumber)}` : null,
  ].filter((line): line is string => line !== null);

  const noteBlocks = [
    data.invoiceFooterText ? `<p class="invoice-note">${escapeHtml(data.invoiceFooterText)}</p>` : "",
    data.invoiceTermsText ? `<p class="invoice-note invoice-terms"><strong>Terms:</strong> ${escapeHtml(data.invoiceTermsText)}</p>` : "",
  ].join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 24px; margin-bottom: 32px; }
  .store-name { font-size: 28px; font-weight: bold; letter-spacing: 0.5px; }
  .store-logo { max-height: 56px; max-width: 220px; object-fit: contain; }
  .invoice-label { text-align: right; }
  .invoice-label h1 { font-size: 20px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 2px; }
  .meta { color: #555; font-size: 13px; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 32px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { text-align: left; border-bottom: 1px solid #1a1a1a; padding: 8px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  tbody td { padding: 8px 4px; border-bottom: 1px solid #eee; }
  .num { text-align: right; }
  tfoot td { padding: 8px 4px; border: none; }
  .grand-total td { font-weight: bold; font-size: 16px; border-top: 2px solid #1a1a1a; }
  .invoice-notes { margin-top: 32px; }
  .invoice-note { font-size: 12px; color: #555; margin: 0 0 8px; }
  .platform-footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    ${
      data.logoUrl
        ? `<img class="store-logo" src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.storeName)}" />`
        : `<div class="store-name">${escapeHtml(data.storeName)}</div>`
    }
    <div class="invoice-label">
      <h1>Invoice</h1>
      <div class="meta">Order #${data.orderId.slice(0, 8).toUpperCase()}</div>
      <div class="meta">${data.placedAt.toISOString().slice(0, 10)}</div>
    </div>
  </div>
  <div class="parties">
    <div>
      <strong>Billed to</strong><br />
      ${escapeHtml(data.buyerName)}<br />
      ${escapeHtml(data.buyerEmail)}
    </div>
    ${
      soldByLines.length > 0
        ? `<div>
      <strong>Sold by</strong><br />
      ${soldByLines.join("<br />")}
    </div>`
        : ""
    }
  </div>
  <table>
    <thead>
      <tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Line total</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="3">Subtotal</td><td class="num">${money(data.subtotal, data.currency)}</td></tr>
      ${data.discountAmount > 0 ? `<tr><td colspan="3">Discount</td><td class="num">-${money(data.discountAmount, data.currency)}</td></tr>` : ""}
      <tr><td colspan="3">Shipping</td><td class="num">${money(data.shippingAmount, data.currency)}</td></tr>
      ${taxLine}
      <tr class="grand-total"><td colspan="3">Total</td><td class="num">${money(data.totalAmount, data.currency)}</td></tr>
    </tfoot>
  </table>
  ${noteBlocks ? `<div class="invoice-notes">${noteBlocks}</div>` : ""}
  <div class="platform-footer">Generated on uzeyn.com</div>
</body>
</html>`;
}
