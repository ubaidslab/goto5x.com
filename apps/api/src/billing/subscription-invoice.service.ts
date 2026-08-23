import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { InvoicePdfService } from "../invoices/invoice-pdf.service";
import { renderSubscriptionInvoiceHtml } from "./subscription-invoice-template";

/**
 * SRS §5.6k/FR-6.47 (Module 70) - on-demand generation, not scheduled/
 * cached: a seller downloads it when they want it, scoped to their own
 * verified plan-fee payments (WalletTopUpRequest.planFeePortion) and any
 * refund_adjustment LedgerEntry rows for the requested period.
 */
@Injectable()
export class SubscriptionInvoiceService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  /** `month` in "YYYY-MM" form (UTC calendar month). */
  async generate(sellerId: string, month: string): Promise<Buffer> {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) throw new BadRequestException('month must be in "YYYY-MM" form.');
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const periodStart = new Date(Date.UTC(year, monthIndex, 1));
    const periodEnd = new Date(Date.UTC(year, monthIndex + 1, 1));

    const seller = await this.prismaAdmin.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException("Seller not found.");

    const [verifiedPayments, refundEntries] = await Promise.all([
      this.prismaAdmin.walletTopUpRequest.findMany({
        where: {
          ownerType: "seller",
          ownerId: sellerId,
          status: "verified",
          planFeePortion: { not: null },
          verifiedAt: { gte: periodStart, lt: periodEnd },
        },
        select: { verifiedAt: true, planFeePortion: true, currency: true },
      }),
      this.prismaAdmin.ledgerEntry.findMany({
        where: { sellerId, type: "refund_adjustment", createdAt: { gte: periodStart, lt: periodEnd } },
        select: { createdAt: true, amount: true, currency: true },
      }),
    ]);

    const currency = verifiedPayments[0]?.currency ?? refundEntries[0]?.currency ?? "PKR";
    const html = renderSubscriptionInvoiceHtml({
      businessName: seller.businessName,
      periodStart,
      periodEnd,
      currency,
      payments: verifiedPayments.map((p) => ({ paidAt: p.verifiedAt!, amount: Number(p.planFeePortion) })),
      refunds: refundEntries.map((r) => ({ creditedAt: r.createdAt, amount: Number(r.amount) })),
    });

    const buffer = await this.invoicePdf.renderToBuffer(html);
    if (!buffer) throw new BadRequestException("Invoice PDF rendering failed - please try again.");
    return buffer;
  }
}
