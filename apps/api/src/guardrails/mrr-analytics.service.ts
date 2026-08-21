import { Injectable } from "@nestjs/common";
import { Plan, PlanBillingInterval } from "@prisma/client";
import { round2 } from "../orders/money.util";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { computeCyclePrice, resolveActivePlanPrice } from "../plans/plan-pricing.util";
import { SettingsService } from "../settings-registry/settings.service";

const MONTHS_BY_INTERVAL: Record<PlanBillingInterval, number> = {
  monthly: 1,
  six_month: 6,
  yearly: 12,
  none: 1,
};

/**
 * SRS §5.6k (v0.41), FR-6.40 (Module 63) - MRR analytics, extending
 * FR-8.10's admin analytics surface. Computed live against
 * Subscription/Plan and verified WalletTopUpRequest rows (the real record
 * of a plan-fee payment under FR-6.50's admin-verify flow - see that
 * flow's own documented behavior: "never posts a wallet_plan_fee_debit
 * for the plan-fee portion, since that money never entered the wallet").
 * "Active" throughout this service means currentPeriodEnd >= now - a
 * subscription whose period has lapsed is, by definition, not currently
 * generating recurring revenue, whatever its Store's pause status.
 */
@Injectable()
export class MrrAnalyticsService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  async compute() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [sixMonthMultiplier, yearlyMultiplier] = await Promise.all([
      this.settings.resolve<number>("billing.six_month_price_multiplier"),
      this.settings.resolve<number>("billing.yearly_price_multiplier"),
    ]);
    const multipliers = { sixMonth: sixMonthMultiplier, yearly: yearlyMultiplier };

    const paidSubscriptions = await this.prismaAdmin.subscription.findMany({
      where: { sellerId: { not: null }, plan: { planGroup: "individual", price: { gt: 0 } } },
      include: { plan: true },
    });

    const activeSubscriptions = paidSubscriptions.filter((s) => s.currentPeriodEnd && s.currentPeriodEnd >= now);
    const expiredNotRenewedCount = paidSubscriptions.filter((s) => s.currentPeriodEnd && s.currentPeriodEnd < now).length;
    const renewalsIn7Days = activeSubscriptions.filter((s) => s.currentPeriodEnd! <= in7Days).length;
    const renewalsIn30Days = activeSubscriptions.filter((s) => s.currentPeriodEnd! <= in30Days).length;

    const mrr = activeSubscriptions.reduce((sum, s) => sum + this.monthlyNormalizedPrice(s.plan, s.billingInterval, multipliers), 0);

    const activeByTier: Record<string, number> = {};
    for (const s of activeSubscriptions) {
      activeByTier[s.plan.name] = (activeByTier[s.plan.name] ?? 0) + 1;
    }

    // Churn: sellers whose store entered terminal (plan-fee non-payment)
    // pause in the trailing 30 days, as a share of currently-active
    // subscriptions - a live approximation (no cohort-snapshot table),
    // same "computed live, not precomputed" discipline FR-8.10 commits to.
    const recentlyChurnedStores = await this.prismaAdmin.store.findMany({
      where: { terminalPausedAt: { gte: thirtyDaysAgo } },
      select: { sellerId: true },
      distinct: ["sellerId"],
    });
    const churnRate = activeSubscriptions.length > 0 ? round4(recentlyChurnedStores.length / activeSubscriptions.length) : 0;

    const verifiedPlanFeePayments = await this.prismaAdmin.walletTopUpRequest.findMany({
      where: { ownerType: "seller", planFeePortion: { not: null }, status: "verified" },
      select: { ownerId: true, planFeePortion: true, verifiedAt: true },
    });
    const paymentCountBySeller = new Map<string, number>();
    for (const p of verifiedPlanFeePayments) {
      paymentCountBySeller.set(p.ownerId, (paymentCountBySeller.get(p.ownerId) ?? 0) + 1);
    }
    const sellersWithAnyPayment = paymentCountBySeller.size;
    const sellersWithRenewal = [...paymentCountBySeller.values()].filter((count) => count >= 2).length;
    const firstCycleToFullConversionRate = sellersWithAnyPayment > 0 ? round4(sellersWithRenewal / sellersWithAnyPayment) : 0;

    const trailing30dRevenue = verifiedPlanFeePayments
      .filter((p) => p.verifiedAt && p.verifiedAt >= thirtyDaysAgo)
      .reduce((sum, p) => sum + Number(p.planFeePortion), 0);
    const arps = activeSubscriptions.length > 0 ? round2(trailing30dRevenue / activeSubscriptions.length) : 0;
    const ltvEstimate = churnRate > 0 ? round2(arps / churnRate) : null;

    const renewingThisMonth = activeSubscriptions.filter(
      (s) => s.currentPeriodEnd! >= monthStart && s.currentPeriodEnd! < monthEnd,
    );
    const expectedRevenueThisMonth = renewingThisMonth.reduce((sum, s) => {
      const activeMonthly = resolveActivePlanPrice(s.plan);
      return sum + computeCyclePrice(activeMonthly, s.billingInterval as "monthly" | "six_month" | "yearly", multipliers);
    }, 0);

    return {
      mrr: round2(mrr),
      activeSubscriptionsByTier: activeByTier,
      activeSubscriptionCount: activeSubscriptions.length,
      upcomingRenewals7d: renewalsIn7Days,
      upcomingRenewals30d: renewalsIn30Days,
      expiredNotRenewedCount,
      churnRatePercent: round2(churnRate * 100),
      arps,
      ltvEstimate,
      firstCycleToFullConversionRatePercent: round2(firstCycleToFullConversionRate * 100),
      expectedRevenueThisMonth: round2(expectedRevenueThisMonth),
    };
  }

  private monthlyNormalizedPrice(
    plan: Plan,
    billingInterval: PlanBillingInterval,
    multipliers: { sixMonth: number; yearly: number },
  ): number {
    const activeMonthly = resolveActivePlanPrice(plan);
    const cyclePrice = computeCyclePrice(activeMonthly, billingInterval as "monthly" | "six_month" | "yearly", multipliers);
    return cyclePrice / MONTHS_BY_INTERVAL[billingInterval];
  }
}

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
