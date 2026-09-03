import { Injectable } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { bucketSalesOverTime, SalesBucket } from "../analytics/analytics.util";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

/**
 * Same Financial Truth Invariant gate every other analytics reader in this
 * codebase keeps a local copy of (no shared constants module exists for it
 * - see analytics.util.ts's own comment on this).
 */
const CONFIRMED_OR_BEYOND: OrderStatus[] = ["confirmed", "shipped", "delivered", "completed"];

/**
 * SRS §5.23/FR-23.4 - unit-economics data, extending FR-8.10 (real-time
 * platform analytics). FR-8.10 itself is not built yet (Module 17's job,
 * per docs/build-plan.md's module sequence - "Zero dashboard work in this
 * revision" note) - this is the data computation only, no admin dashboard
 * UI. Disclosed scope decision, see build-plan.md's Module 14 note.
 */
@Injectable()
export class UnitEconomicsService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  async computeSummary() {
    // v0.33 - there is no more Free Plan, so the free/paid store split this
    // used to report is gone; every store's seller is on a paid
    // subscription (SRS FR-7.1/7.3), so a single total is now the accurate
    // number.
    const storeIds = (await this.prismaAdmin.store.findMany({ select: { id: true } })).map((s) => s.id);

    // Financial Truth Invariant (§3.12) - only commission_accrued/waived
    // entries count as real revenue, the same rule LedgerService itself
    // enforces at accrual time; an unpaid order never reaches this table
    // at all (FR-6.16), so no extra filtering is needed here.
    const [totalCommission, monthlyInfraCost] = await Promise.all([
      this.commissionForStores(storeIds),
      this.settings.resolve<number>("finance.monthly_infra_cost"),
    ]);

    const storageByStore = await this.prismaAdmin.mediaAsset.groupBy({
      by: ["storeId"],
      _sum: { sizeBytes: true },
    });

    return {
      storeCount: storeIds.length,
      totalCommission,
      monthlyInfraCost,
      breakEven: totalCommission - monthlyInfraCost,
      storageUsageByStore: storageByStore.map((row) => ({
        storeId: row.storeId,
        bytes: row._sum.sizeBytes ?? 0,
      })),
    };
  }

  /**
   * SRS FR-8.10 - real-time platform analytics (GMV, revenue/commission
   * earned, active store count, top sellers), computed live against the
   * transactional tables at launch volume - no pre-aggregation table.
   * Financial Truth Invariant (§3.12): GMV excludes `pending` orders (never
   * paid, per the mark-as-paid flow) the same way commission excludes them
   * by construction (LedgerService never writes a `commission_accrued` row
   * for one); revenue in this business model (Direct Seller Collection) IS
   * commission earned - UZEYN never touches order money itself.
   *
   * SRS FR-8.19 (Module 98) - `start`/`end` are optional; omitted, every
   * figure below is all-time (unchanged from before this FR). Active store
   * count is deliberately NOT range-filtered - see FR-8.19's own text on
   * why a point-in-time count has no "during a past range" meaning here.
   */
  async computeRealTimeAnalytics(start?: Date, end?: Date) {
    const orderDateFilter = start && end ? { placedAt: { gte: start, lte: end } } : {};
    const ledgerDateFilter = start && end ? { createdAt: { gte: start, lte: end } } : {};

    const [gmv, activeStoreCount, commissionResult, topSellerRows] = await Promise.all([
      this.prismaAdmin.order.aggregate({
        // Module 53 (FR-60.4) - a fully refunded order stops counting as
        // GMV the same instant it stops counting as revenue/commission
        // (the ledger reversal below); partially_refunded is excluded too,
        // same "one signal, applied uniformly" simplification PnLService's
        // CONFIRMED_OR_BEYOND already applies to both statuses.
        where: { status: { notIn: ["pending", "refunded", "partially_refunded"] }, ...orderDateFilter },
        _sum: { totalAmount: true },
      }),
      this.prismaAdmin.store.count({ where: { status: "active" } }),
      this.prismaAdmin.ledgerEntry.aggregate({
        where: { type: { in: ["commission_accrued", "commission_waived", "refund_adjustment"] }, ...ledgerDateFilter },
        _sum: { amount: true },
      }),
      this.prismaAdmin.ledgerEntry.groupBy({
        by: ["sellerId"],
        where: { type: { in: ["commission_accrued", "commission_waived", "refund_adjustment"] }, ...ledgerDateFilter },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
    ]);

    const sellerIds = topSellerRows.map((r) => r.sellerId);
    const sellers = await this.prismaAdmin.seller.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, businessName: true },
    });
    const sellerById = new Map(sellers.map((s) => [s.id, s.businessName]));

    return {
      gmv: Number(gmv._sum.totalAmount ?? 0),
      revenue: Number(commissionResult._sum.amount ?? 0),
      commissionEarned: Number(commissionResult._sum.amount ?? 0),
      activeStoreCount,
      topSellers: topSellerRows.map((row) => ({
        sellerId: row.sellerId,
        businessName: sellerById.get(row.sellerId) ?? null,
        commissionEarned: Number(row._sum.amount ?? 0),
      })),
    };
  }

  /**
   * SRS FR-8.19 (Module 98) - platform-wide sales-over-time, day/week/month,
   * mirroring FR-61.2's seller-facing shape exactly and reusing its own
   * bucketing utility (bucketSalesOverTime) rather than a second
   * implementation. No storeId filter - that's the whole point over
   * FR-61.2's per-store chart.
   */
  async getSalesOverTime(bucket: SalesBucket, start: Date, end: Date) {
    const orders = await this.prismaAdmin.order.findMany({
      where: { status: { in: CONFIRMED_OR_BEYOND }, placedAt: { gte: start, lte: end } },
      select: { placedAt: true, totalAmount: true },
    });
    return bucketSalesOverTime(
      orders.map((o) => ({ placedAt: o.placedAt, totalAmount: Number(o.totalAmount) })),
      bucket,
      start,
      end,
    );
  }

  private async commissionForStores(storeIds: string[]): Promise<number> {
    if (storeIds.length === 0) return 0;
    const sellerIds = (
      await this.prismaAdmin.store.findMany({ where: { id: { in: storeIds } }, select: { sellerId: true } })
    ).map((s) => s.sellerId);

    const result = await this.prismaAdmin.ledgerEntry.aggregate({
      where: { sellerId: { in: sellerIds }, type: { in: ["commission_accrued", "commission_waived", "refund_adjustment"] } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}
