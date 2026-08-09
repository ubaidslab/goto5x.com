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

/** Module 57 (SRS §5.64/FR-64.1/64.2) - seller-controlled invoice customization fields, each present only when set. */
describe("Invoice template customization fields (FR-64.1/64.2)", () => {
  it("renders business name, tax/NTN number, footer text, and terms text when all are set", () => {
    const html = renderInvoiceHtml({
      ...baseData,
      businessName: "Ayesha Textiles (Pvt) Ltd",
      taxNumber: "1234567-8",
      invoiceFooterText: "Thank you for shopping with us.",
      invoiceTermsText: "All sales are final after 7 days.",
    });
    expect(html).toContain("Ayesha Textiles (Pvt) Ltd");
    expect(html).toContain("Tax/NTN: 1234567-8");
    expect(html).toContain("Thank you for shopping with us.");
    expect(html).toContain("All sales are final after 7 days.");
  });

  it("renders none of the four fields - not even a blank placeholder - when all are unset", () => {
    const html = renderInvoiceHtml({ ...baseData, businessName: null, taxNumber: null, invoiceFooterText: null, invoiceTermsText: null });
    expect(html).not.toContain("Sold by");
    expect(html).not.toContain("Tax/NTN");
    expect(html).not.toContain('<div class="invoice-notes">');
    expect(html).not.toContain("Terms:");
  });

  it("renders only the fields that are set, leaving the others absent", () => {
    const html = renderInvoiceHtml({ ...baseData, businessName: "Solo Business Name", taxNumber: null, invoiceFooterText: null, invoiceTermsText: null });
    expect(html).toContain("Sold by");
    expect(html).toContain("Solo Business Name");
    expect(html).not.toContain("Tax/NTN");
    expect(html).not.toContain('<div class="invoice-notes">');
  });

  it("escapes business name, tax number, footer, and terms text to prevent HTML injection", () => {
    const html = renderInvoiceHtml({
      ...baseData,
      businessName: "<script>alert(3)</script>",
      taxNumber: '"><script>alert(4)</script>',
      invoiceFooterText: "<script>alert(5)</script>",
      invoiceTermsText: "<script>alert(6)</script>",
    });
    expect(html).not.toContain("<script>alert(3)</script>");
    expect(html).not.toContain("<script>alert(4)</script>");
    expect(html).not.toContain("<script>alert(5)</script>");
    expect(html).not.toContain("<script>alert(6)</script>");
  });
});

/** FR-64.4 - UZEYN's own invoice branding is mandatory and non-removable, regardless of which seller-controlled fields above are set. */
describe("Invoice template mandatory platform branding (FR-64.4)", () => {
  it("always includes the platform footer, with none of the optional fields set", () => {
    const html = renderInvoiceHtml({ ...baseData, businessName: null, taxNumber: null, invoiceFooterText: null, invoiceTermsText: null });
    expect(html).toContain('<div class="platform-footer">Generated on uzeyn.com</div>');
  });

  it("still includes the unmodified platform footer even when every seller-controlled field is set", () => {
    const html = renderInvoiceHtml({
      ...baseData,
      businessName: "Ayesha Textiles (Pvt) Ltd",
      taxNumber: "1234567-8",
      invoiceFooterText: "Thank you for shopping with us.",
      invoiceTermsText: "All sales are final after 7 days.",
    });
    expect(html).toContain('<div class="platform-footer">Generated on uzeyn.com</div>');
  });
});
