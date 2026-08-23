import { Controller, Get, InternalServerErrorException, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AdminAuthGuard } from "../common/guards/admin-auth.guard";
import { InvoicePdfService } from "../invoices/invoice-pdf.service";
import { toCsv } from "../data-portability/csv.util";
import { FinanceTerminalService } from "./finance-terminal.service";
import { renderFinanceSummaryHtml } from "./finance-summary-template";

const SUMMARY_CSV_HEADER = ["Metric", "Value"];

/**
 * Founder-approved Finance Terminal (own admin nav item, checkpoint-gated
 * same as every other financial admin surface here). Deliberately does NOT
 * re-expose the pending-verification queue (AdminWalletController.
 * listPending() already covers that - the frontend hub links/re-embeds it)
 * or per-period revenue (MrrAnalyticsService.compute(), reused via the
 * existing admin/analytics/mrr route) - only the genuinely new reads live
 * on this controller.
 */
@Controller("admin/finance")
@UseGuards(AdminAuthGuard)
export class AdminFinanceTerminalController {
  constructor(
    private readonly financeTerminal: FinanceTerminalService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get("refunds")
  refundHistory(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.financeTerminal.refundHistory(page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  @Get("growth-program-obligations")
  growthProgramObligations() {
    return this.financeTerminal.growthProgramObligations();
  }

  @Get("commission-by-tier")
  commissionByTier() {
    return this.financeTerminal.commissionStatusByTier();
  }

  @Get("export.csv")
  async exportCsv(@Res({ passthrough: true }) res: Response) {
    const summary = await this.financeTerminal.buildExportSummary();
    const rows: (string | number)[][] = [
      ["Generated At", summary.generatedAt.toISOString()],
      ["MRR", summary.mrr],
      ["Active Subscriptions", summary.activeSubscriptionCount],
      ["Realized Revenue This Month", summary.realizedRevenueThisMonth],
      ["Realized Revenue This Quarter", summary.realizedRevenueThisQuarter],
      ["ARPS", summary.arps],
      ["Churn Rate Percent", summary.churnRatePercent],
      ["Total Refunded", summary.totalRefunded],
      ["Refund Count", summary.refundCount],
      ...summary.growthProgramObligations.map((p) => [`Outstanding Obligations - ${p.programType}`, p.outstandingAmount]),
      ["Total Outstanding Obligations", summary.totalOutstandingObligations],
    ];
    const csv = toCsv(SUMMARY_CSV_HEADER, rows);
    res.set({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="finance-terminal-summary-${Date.now()}.csv"`,
    });
    return new StreamableFile(Buffer.from(csv, "utf-8"));
  }

  @Get("export.pdf")
  async exportPdf(@Res({ passthrough: true }) res: Response) {
    const summary = await this.financeTerminal.buildExportSummary();
    const buffer = await this.invoicePdf.renderToBuffer(renderFinanceSummaryHtml(summary));
    if (!buffer) {
      throw new InternalServerErrorException("PDF generation failed - try again, or use the CSV export instead.");
    }
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="finance-terminal-summary-${Date.now()}.pdf"`,
    });
    return new StreamableFile(buffer);
  }
}
