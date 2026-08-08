import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { TenantPrismaService } from "../prisma/tenant-prisma.service";
import { SubscriptionsService } from "../plans/subscriptions.service";
import { SettingsService } from "../settings-registry/settings.service";
import { AuditLogService } from "../admin/audit-log.service";
import { round2 } from "../orders/money.util";
import { WalletService } from "./wallet.service";

/** The billing period this invoice run is for: the full previous calendar month. */
function previousCalendarMonth(now: Date): { periodStart: Date; periodEnd: Date } {
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() - 1, 1));
  return { periodStart, periodEnd };
}

/**
 * FR-6.17/FR-6.18/FR-6.20. Uses PrismaAdminService throughout - invoice
 * generation and the overdue sweep span every seller at once (no single
 * seller session to scope a TenantPrismaService transaction to), and admin
 * mark-paid/waive actions are already gated by AdminAuthGuard at the
 * controller layer (the same "narrow, deliberately-scoped BYPASSRLS" case
 * #1 documented on PrismaAdminService itself).
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
    private readonly subscriptions: SubscriptionsService,
    private readonly wallet: WalletService,
  ) {}

  /** Seller's own invoice list/detail (own dashboard, not admin). */
  async listForSeller(sellerId: string) {
    return this.tenantPrisma.run(sellerId, (tx) => tx.sellerInvoice.findMany({ orderBy: { periodStart: "desc" } }));
  }

  async listAllForAdmin() {
    return this.prismaAdmin.sellerInvoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { seller: { select: { businessName: true } } },
    });
  }

  /**
   * FR-6.17 - one invoice per seller per billing period, summing that
   * period's unattached commission_accrued/commission_waived entries. Never
   * re-processes an entry already attached to a prior invoice (`invoiceId:
   * null` in the query), and never regenerates for a period already
   * invoiced for that seller (checked via a unique-in-practice periodStart
   * match, since this job runs once a month).
   */
  async generateMonthlyInvoices(now = new Date()): Promise<{ generated: number }> {
    const { periodStart, periodEnd } = previousCalendarMonth(now);
    const graceDays = await this.settings.resolve<number>("billing.invoice_grace_period_days");

    const sellersWithActivity = await this.prismaAdmin.ledgerEntry.groupBy({
      by: ["sellerId"],
      where: {
        invoiceId: null,
        // Module 53 (FR-60.4) - a refund's commission reversal is unattached
        // (invoiceId: null) exactly like a waiver, so it must sweep into the
        // seller's next invoice the same way, reducing what they owe.
        type: { in: ["commission_accrued", "commission_waived", "refund_adjustment"] },
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    });

    let generated = 0;
    for (const { sellerId } of sellersWithActivity) {
      const alreadyInvoiced = await this.prismaAdmin.sellerInvoice.findFirst({
        where: { sellerId, periodStart },
      });
      if (alreadyInvoiced) continue; // idempotent re-run safety

      await this.prismaAdmin.$transaction(async (tx) => {
        const entries = await tx.ledgerEntry.findMany({
          where: {
            sellerId,
            invoiceId: null,
            type: { in: ["commission_accrued", "commission_waived", "refund_adjustment"] },
            createdAt: { gte: periodStart, lt: periodEnd },
          },
        });
        const totalAmount = round2(entries.reduce((sum, e) => sum + Number(e.amount), 0));
        const currency = entries[0]?.currency ?? "PKR";
        const dueDate = new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);

        const invoice = await tx.sellerInvoice.create({
          data: { sellerId, periodStart, periodEnd, totalAmount, currency, dueDate },
        });
        await tx.ledgerEntry.updateMany({
          where: { id: { in: entries.map((e) => e.id) } },
          data: { invoiceId: invoice.id },
        });
      });
      generated += 1;
    }

    return { generated };
  }

  /**
   * FR-6.18 - an invoice unpaid past its due_date (= period_end + grace
   * days, computed at generation time) suspends every one of that seller's
   * currently-active stores. Only touches stores this mechanism itself
   * could have suspended (status = 'active') - never overwrites an
   * independently admin-issued suspension/ban.
   *
   * FR-7.15/FR-7.18 (revised v0.19, target updated v0.33) - a
   * `group_sponsorship` invoice is a different kind of debt: non-payment
   * never suspends the leader's store (or a member's) - it gracefully
   * downgrades every currently-sponsored member to Starter (the entry paid
   * tier, now that Free no longer exists) at their own next cycle, the
   * identical mechanism FR-7.13 already uses for a voluntary leave.
   */
  async sweepOverdueInvoicesAndSuspend(now = new Date()): Promise<{ suspended: number }> {
    const overdue = await this.prismaAdmin.sellerInvoice.findMany({
      where: { status: "pending", dueDate: { lt: now } },
    });

    let suspended = 0;
    for (const invoice of overdue) {
      await this.prismaAdmin.sellerInvoice.update({ where: { id: invoice.id }, data: { status: "overdue" } });

      if (invoice.invoiceType === "group_sponsorship") {
        const activeMembers = await this.prismaAdmin.teamMember.findMany({
          where: { teamId: invoice.teamId!, status: "active" },
        });
        for (const member of activeMembers) {
          await this.subscriptions.scheduleDowngradeToStarterAtPeriodEnd(member.sellerId);
        }
        continue;
      }

      const result = await this.prismaAdmin.store.updateMany({
        where: { sellerId: invoice.sellerId, status: "active" },
        data: { status: "suspended" },
      });
      suspended += result.count;
    }
    return { suspended };
  }

  /** FR-6.17 - manual admin verification; lifts any grace-period suspension this invoice caused (commission invoices only - see sweep note above). */
  async markPaid(invoiceId: string, adminUserId: string) {
    const before = await this.prismaAdmin.sellerInvoice.findUnique({ where: { id: invoiceId } });
    if (!before) throw new NotFoundException("Invoice not found.");
    if (before.status === "paid") throw new BadRequestException("This invoice is already marked paid.");

    const after = await this.prismaAdmin.sellerInvoice.update({
      where: { id: invoiceId },
      data: { status: "paid", paidAt: new Date(), paidBy: adminUserId },
    });
    if (before.invoiceType === "commission") {
      await this.prismaAdmin.store.updateMany({
        where: { sellerId: before.sellerId, status: "suspended" },
        data: { status: "active" },
      });
    }

    await this.auditLog.record({
      adminUserId,
      action: "billing.invoice_marked_paid",
      targetType: "seller_invoice",
      targetId: invoiceId,
      beforeValue: { status: before.status },
      afterValue: { status: after.status, paidAt: after.paidAt },
    });

    return after;
  }

  /**
   * FR-7.15/FR-7.18 - one consolidated monthly group invoice per team,
   * alongside (never merged into) the leader's own separate commission
   * invoice above. total = (active sponsored member count) x the leader's
   * Team tier's seat price - every seat bills at the same, tier-determined
   * price, never a per-member-chosen amount.
   */
  async generateMonthlyGroupInvoices(now = new Date()): Promise<{ generated: number }> {
    const { periodStart, periodEnd } = previousCalendarMonth(now);
    const graceDays = await this.settings.resolve<number>("billing.invoice_grace_period_days");

    const teams = await this.prismaAdmin.team.findMany({ include: { plan: true } });
    let generated = 0;
    for (const team of teams) {
      const alreadyInvoiced = await this.prismaAdmin.sellerInvoice.findFirst({
        where: { teamId: team.id, invoiceType: "group_sponsorship", periodStart },
      });
      if (alreadyInvoiced) continue; // idempotent re-run safety

      const activeMemberCount = await this.prismaAdmin.teamMember.count({
        where: { teamId: team.id, status: "active" },
      });
      if (activeMemberCount === 0) continue; // no invoice for an empty team

      const totalAmount = round2(activeMemberCount * Number(team.plan.seatPrice ?? 0));
      const dueDate = new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);

      await this.prismaAdmin.sellerInvoice.create({
        data: {
          sellerId: team.leaderSellerId,
          invoiceType: "group_sponsorship",
          teamId: team.id,
          periodStart,
          periodEnd,
          totalAmount,
          currency: team.plan.currency,
          dueDate,
        },
      });
      generated += 1;
    }
    return { generated };
  }

  /** FR-6.20 - a specific accrued-commission line, never a blanket balance rewrite. */
  async waiveCommission(sellerId: string, orderId: string, amount: number, adminUserId: string) {
    const accrued = await this.prismaAdmin.ledgerEntry.findFirst({
      where: { sellerId, orderId, type: "commission_accrued" },
    });
    if (!accrued) throw new NotFoundException("No accrued commission found for that order.");

    const entry = await this.prismaAdmin.$transaction((tx) =>
      this.wallet.postLedgerEntry(tx, { sellerId, orderId, type: "commission_waived", amount: -Math.abs(amount), currency: accrued.currency }),
    );

    await this.auditLog.record({
      adminUserId,
      action: "billing.commission_waived",
      targetType: "ledger_entry",
      targetId: entry.id,
      beforeValue: { orderId, accruedAmount: accrued.amount },
      afterValue: { waivedAmount: entry.amount },
    });

    return entry;
  }
}
