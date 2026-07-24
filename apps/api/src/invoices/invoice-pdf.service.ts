import { Injectable, Logger } from "@nestjs/common";
import { chromium } from "playwright";
import { ObjectStorageService } from "../media/object-storage.service";
import { InvoiceData, renderInvoiceHtml } from "./invoice-template";

/**
 * FR-19.1 - self-hosted PDF invoice/receipt generation (no paid invoicing
 * service): render HTML/CSS then to PDF via a headless-Chromium worker
 * (Playwright), per docs/tech-stack.md's pinned approach. Generated once at
 * order-placement time (CheckoutService.placeOrder(), the same moment the
 * order-confirmation email already sends) and reused on every subsequent
 * view via the cached `Order.invoicePdfUrl` - never regenerated.
 */
@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(private readonly objectStorage: ObjectStorageService) {}

  /**
   * Best-effort: a PDF-rendering failure must never block the order itself
   * from being placed (same "the triggering action must never fail because
   * of a bookkeeping write" discipline as EventsService, FR-26.3). Returns
   * null on failure - CheckoutService simply leaves `invoicePdfUrl` unset.
   */
  async generate(data: InvoiceData): Promise<string | null> {
    try {
      const pdf = await this.renderPdfBuffer(renderInvoiceHtml(data));
      const key = `stores/${data.storeId}/invoices/${data.orderId}.pdf`;
      return await this.objectStorage.putObject(key, pdf, "application/pdf");
    } catch (err) {
      this.logger.warn(`Invoice PDF generation failed for order ${data.orderId}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Module 24 (SRS §5.36, FR-36.2) - reuses the exact same Playwright
   * HTML->PDF renderer for the data-export summary PDF, per the FR's own
   * "no new PDF engine" constraint. Returns the raw buffer (rather than
   * uploading itself) so a caller that also needs the same bytes for a
   * second destination (e.g. a Google Drive upload) never has to render
   * twice. Best-effort - returns null on failure rather than throwing.
   */
  async renderToBuffer(html: string): Promise<Buffer | null> {
    try {
      return await this.renderPdfBuffer(html);
    } catch (err) {
      this.logger.warn(`PDF rendering failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async renderPdfBuffer(html: string): Promise<Buffer> {
    let browser;
    try {
      browser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      return await page.pdf({ format: "A4", printBackground: true });
    } finally {
      await browser?.close();
    }
  }
}
