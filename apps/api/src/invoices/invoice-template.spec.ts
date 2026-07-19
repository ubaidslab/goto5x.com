import { InvoiceData, renderInvoiceHtml } from "./invoice-template";

const baseData: InvoiceData = {
  orderId: "11111111-1111-1111-1111-111111111111",
  storeId: "store-1",
  storeName: "Ayesha's Boutique",
  currency: "PKR",
  placedAt: new Date("2026-01-01T00:00:00.000Z"),
  buyerName: "Sara Ahmed",
  buyerEmail: "sara@example.com",
  items: [{ title: "Widget", quantity: 2, unitPrice: 500 }],
  subtotal: 1000,
  discountAmount: 0,
  shippingAmount: 100,
  taxAmount: 0,
  taxLabel: "GST",
  taxInclusive: false,
  totalAmount: 1100,
};

/** SRS FR-32.5/FR-19.2 - the header shows the seller's logo when set, falling back to the typographic store name otherwise. */
describe("Invoice template logo fallback (FR-32.5)", () => {
  it("renders the store name as a typographic mark when no logo is set", () => {
    const html = renderInvoiceHtml({ ...baseData, logoUrl: null });
    expect(html).toContain('<div class="store-name">Ayesha&#39;s Boutique</div>');
    expect(html).not.toContain('<img class="store-logo"');
  });

  it("renders the uploaded logo image instead of the store name when a logo is set", () => {
    const html = renderInvoiceHtml({ ...baseData, logoUrl: "https://cdn.example.com/logo.png" });
    expect(html).toContain('<img class="store-logo" src="https://cdn.example.com/logo.png" alt="Ayesha&#39;s Boutique" />');
    expect(html).not.toContain('<div class="store-name">');
  });

  it("escapes the logo URL and store name to prevent HTML injection", () => {
    const html = renderInvoiceHtml({
      ...baseData,
      storeName: '<script>alert(1)</script>',
      logoUrl: '"><script>alert(2)</script>',
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(2)</script>");
  });
});
