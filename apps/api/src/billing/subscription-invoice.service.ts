import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { InvoicePdfService } from "../invoices/invoice-pdf.service";
import { renderSubscriptionInvoiceHtml } from "./subscription-invoice-template";

/**
 * SRS §5.6k/FR-6.47 (Module 70) - on-demand generation, not scheduled/
 * cached: a seller downloads it when they want it, scoped to their own
 * verified plan-fee payments (WalletTopUpRequest.planFeePortion) and any
 * refund_adjustment LedgerEntry rows for the requested period.
 *
 * D88 item 1 - the seller existence check stays on prismaAdmin (Seller
 * is the tenant root, not tenant-owned data, and has to be resolved
 * before a tenant transaction scoped to it can even open), but both
 * data reads now go through TenantPrismaService.run() so ledger_entries'
 * existing RLS policy (seller_id = app.current_seller_id) backs the
 * refund query as real defense-in-depth, not just the where clause.
 * wallet_top_up_requests has no RLS policy at all (polymorphic
 * ownerType/ownerId, flagged separately - see D88 report) so that half
 * of the conversion is neutral, not a new guarantee, until one exists.
 */
@Injectable()
export class SubscriptionInvoiceService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
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

    const [verifiedPayments, refundEntries] = await this.tenantPrisma.run(sellerId, async (tx) =>
      Promise.all([
        tx.walletTopUpRequest.findMany({
          where: {
            ownerType: "seller",
            ownerId: sellerId,
            status: "verified",
            planFeePortion: { not: null },
            verifiedAt: { gte: periodStart, lt: periodEnd },
          },
          select: { verifiedAt: true, planFeePortion: true, currency: true },
        }),
        tx.ledgerEntry.findMany({
          where: { sellerId, type: "refund_adjustment", createdAt: { gte: periodStart, lt: periodEnd } },
          select: { createdAt: true, amount: true, currency: true },
        }),
      ]),
    );

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
