import { Controller, Get, Param, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import { OrderStatusLookupService } from "./order-status-lookup.service";

/** FR-5.4 - public, unauthenticated; `token` is the unguessable lookup key, never a sequential order id. */
@Controller("storefront/order-status")
export class OrderStatusLookupController {
  constructor(private readonly lookup: OrderStatusLookupService) {}

  @Get(":token")
  get(@Param("token") token: string) {
    return this.lookup.lookup(token);
  }

  /**
   * Security-audit fix (docs/security-audit-report.md, disclosed finding) -
   * replaces the old plain `Order.invoicePdfUrl` public link: the PDF's
   * bytes are only ever reachable by presenting the same unguessable token
   * every other buyer-facing order-status field already requires, never a
   * standalone public MinIO URL.
   */
  @Get(":token/invoice")
  async getInvoice(@Param("token") token: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { buffer, contentType } = await this.lookup.getInvoicePdf(token);
    res.set({
      "Content-Type": contentType ?? "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${token.slice(0, 8)}.pdf"`,
    });
    return new StreamableFile(buffer);
  }
}
