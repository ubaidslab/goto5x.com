import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";

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
    const stores = await this.prismaAdmin.store.findMany({
      select: { id: true, seller: { select: { subscription: { select: { plan: { select: { tierOrder: true, planGroup: true } } } } } } },
    });
    const freeStoreIds: string[] = [];
    const paidStoreIds: string[] = [];
    for (const store of stores) {
      const plan = store.seller.subscription?.plan;
      const isFree = !plan || (plan.planGroup === "individual" && plan.tierOrder === 0);
      (isFree ? freeStoreIds : paidStoreIds).push(store.id);
    }

    // Financial Truth Invariant (§3.12) - only commission_accrued/waived
    // entries count as real revenue, the same rule LedgerService itself
    // enforces at accrual time; an unpaid order never reaches this table
    // at all (FR-6.16), so no extra filtering is needed here.
    const [freeCommission, paidCommission, monthlyInfraCost] = await Promise.all([
      this.commissionForStores(freeStoreIds),
      this.commissionForStores(paidStoreIds),
      this.settings.resolve<number>("finance.monthly_infra_cost"),
    ]);

    const storageByStore = await this.prismaAdmin.mediaAsset.groupBy({
      by: ["storeId"],
      _sum: { sizeBytes: true },
    });

    const totalCommission = freeCommission + paidCommission;
    return {
      freeStoreCount: freeStoreIds.length,
      paidStoreCount: paidStoreIds.length,
      commissionFromFreeStores: freeCommission,
      commissionFromPaidStores: paidCommission,
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
   * commission earned - goto5x never touches order money itself.
   */
  async computeRealTimeAnalytics() {
    const [gmv, activeStoreCount, commissionResult, topSellerRows] = await Promise.all([
      this.prismaAdmin.order.aggregate({
        where: { status: { not: "pending" } },
        _sum: { totalAmount: true },
      }),
      this.prismaAdmin.store.count({ where: { status: "active" } }),
      this.prismaAdmin.ledgerEntry.aggregate({
        where: { type: { in: ["commission_accrued", "commission_waived"] } },
        _sum: { amount: true },
      }),
      this.prismaAdmin.ledgerEntry.groupBy({
        by: ["sellerId"],
        where: { type: { in: ["commission_accrued", "commission_waived"] } },
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

  private async commissionForStores(storeIds: string[]): Promise<number> {
    if (storeIds.length === 0) return 0;
    const sellerIds = (
      await this.prismaAdmin.store.findMany({ where: { id: { in: storeIds } }, select: { sellerId: true } })
    ).map((s) => s.sellerId);

    const result = await this.prismaAdmin.ledgerEntry.aggregate({
      where: { sellerId: { in: sellerIds }, type: { in: ["commission_accrued", "commission_waived"] } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}
