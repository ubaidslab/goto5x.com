import { Injectable } from "@nestjs/common";
import { PayoutRequestStatus, ReferralProgramType } from "@prisma/client";
import { MrrAnalyticsService } from "../guardrails/mrr-analytics.service";
import { round2 } from "../orders/money.util";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { FinanceSummaryData } from "./finance-summary-template";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

// Same "requested/approved/processing are still owed, only paid/rejected are
// terminal" set program-withdrawal.service.ts's own OUTSTANDING_STATUSES
// already establishes - duplicated here rather than exported cross-module
// since it's a small const, not a shared service call.
const OUTSTANDING_PAYOUT_STATUSES: PayoutRequestStatus[] = ["requested", "approved", "processing"];

/**
 * The Finance Terminal's own aggregation surface (founder-approved scope,
 * Module 90-ish): items the existing per-seller/per-order views never
 * summed platform-wide. Revenue-by-period lives on MrrAnalyticsService
 * (extended in place, item 1) and the pending-verification queue is
 * AdminWalletController.listPending() re-surfaced by the frontend, not
 * duplicated here - this service covers only the genuinely new sums:
 * refund history/totals (item 3), growth-program obligations by program
 * type (item 4), and the commission-by-tier convenience read (item 6).
 */
@Injectable()
export class FinanceTerminalService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
    private readonly mrrAnalytics: MrrAnalyticsService,
  ) {}

  /**
   * refund_adjustment LedgerEntry rows are always stored negative (see the
   * schema's own comment on LedgerEntry.amount) - a refund's real-world
   * magnitude is the absolute value, which is what this returns everywhere
   * ("totalRefunded", not "totalNegativeAdjustment").
   */
  async refundHistory(page = 1, limit = DEFAULT_PAGE_LIMIT) {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.floor(limit)));

    const [entries, total, allForSum] = await Promise.all([
      this.prismaAdmin.ledgerEntry.findMany({
        where: { type: "refund_adjustment" },
        orderBy: { createdAt: "desc" },
        include: { seller: { select: { businessName: true } }, order: { select: { id: true } } },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prismaAdmin.ledgerEntry.count({ where: { type: "refund_adjustment" } }),
      this.prismaAdmin.ledgerEntry.findMany({ where: { type: "refund_adjustment" }, select: { amount: true } }),
    ]);

    const totalRefunded = round2(allForSum.reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0));

    return {
      items: entries.map((e) => ({
        id: e.id,
        sellerId: e.sellerId,
        sellerBusinessName: e.seller.businessName,
        orderId: e.orderId,
        amount: Math.abs(Number(e.amount)),
        currency: e.currency,
        createdAt: e.createdAt,
      })),
      page: safePage,
      limit: safeLimit,
      total,
      totalRefunded,
    };
  }

  /**
   * PayoutRequest carries no programType of its own - a seller withdraws
   * from one shared wallet balance regardless of which program(s) credited
   * it (ProgramWithdrawalService.requestPayout() enforces at most one
   * outstanding request per SELLER, not per program). Attribution here is
   * therefore by the seller's own ProgramParticipant row(s), not the
   * PayoutRequest itself: a seller with exactly one program-participation
   * row attributes cleanly; a seller who (rarely) holds more than one is
   * bucketed under "multiple" rather than guessed at or double-counted,
   * and a seller with none (e.g. a since-rejected/never-approved row that
   * somehow still has an outstanding payout) falls under "unattributed" -
   * both edge buckets keep the grand total exactly equal to the real sum
   * of outstanding PayoutRequest.amount, never inflated or short.
   */
  async growthProgramObligations() {
    const outstanding = await this.prismaAdmin.payoutRequest.findMany({
      where: { status: { in: OUTSTANDING_PAYOUT_STATUSES } },
      select: { sellerId: true, amount: true, status: true },
    });

    const sellerIds = [...new Set(outstanding.map((p) => p.sellerId))];
    const participants = await this.prismaAdmin.programParticipant.findMany({
      where: { sellerId: { in: sellerIds } },
      select: { sellerId: true, programType: true },
    });
    const programTypesBySeller = new Map<string, Set<ReferralProgramType>>();
    for (const p of participants) {
      const set = programTypesBySeller.get(p.sellerId) ?? new Set();
      set.add(p.programType);
      programTypesBySeller.set(p.sellerId, set);
    }

    const buckets = new Map<string, { outstandingAmount: number; count: number }>();
    const bucketFor = (key: string) => {
      if (!buckets.has(key)) buckets.set(key, { outstandingAmount: 0, count: 0 });
      return buckets.get(key)!;
    };

    for (const payout of outstanding) {
      const types = programTypesBySeller.get(payout.sellerId);
      const key = !types || types.size === 0 ? "unattributed" : types.size > 1 ? "multiple" : [...types][0];
      const bucket = bucketFor(key);
      bucket.outstandingAmount += Number(payout.amount);
      bucket.count += 1;
    }

    const totalOutstanding = outstanding.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      byProgram: [...buckets.entries()].map(([programType, v]) => ({
        programType,
        outstandingAmount: round2(v.outstandingAmount),
        count: v.count,
      })),
      totalOutstanding: round2(totalOutstanding),
    };
  }

  /** Optional convenience read (item 6) - loops the existing per-scope resolve() across all four permanent individual tiers in one server-side call. */
  async commissionStatusByTier() {
    const tiers = await this.prismaAdmin.plan.findMany({
      where: { planGroup: "individual" },
      orderBy: { tierOrder: "asc" },
      select: { id: true, name: true, tierOrder: true },
    });

    const globalDefault = await this.settings.resolve<number>("billing.commission_rate_percent");

    const rows = await Promise.all(
      tiers.map(async (tier) => {
        const effectiveValue = await this.settings.resolve<number>("billing.commission_rate_percent", { planId: tier.id });
        return {
          planId: tier.id,
          tierName: tier.name,
          tierOrder: tier.tierOrder,
          commissionPercent: effectiveValue,
          isOverriddenFromGlobal: effectiveValue !== globalDefault,
        };
      }),
    );

    return { globalDefault, tiers: rows };
  }

  /** Item 7 - the combined data both the CSV and PDF export routes render from a single source of truth. */
  async buildExportSummary(): Promise<FinanceSummaryData> {
    const [mrr, refunds, obligations] = await Promise.all([
      this.mrrAnalytics.compute(),
      this.refundHistory(1, MAX_PAGE_LIMIT),
      this.growthProgramObligations(),
    ]);

    return {
      generatedAt: new Date(),
      currency: "PKR",
      mrr: mrr.mrr,
      activeSubscriptionCount: mrr.activeSubscriptionCount,
      realizedRevenueThisMonth: mrr.realizedRevenueThisMonth,
      realizedRevenueThisQuarter: mrr.realizedRevenueThisQuarter,
      arps: mrr.arps,
      churnRatePercent: mrr.churnRatePercent,
      totalRefunded: refunds.totalRefunded,
      refundCount: refunds.total,
      growthProgramObligations: obligations.byProgram,
      totalOutstandingObligations: obligations.totalOutstanding,
    };
  }
}
