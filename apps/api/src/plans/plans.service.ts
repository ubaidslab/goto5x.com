import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { $Enums } from "@prisma/client";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { AuditLogService } from "../admin/audit-log.service";
import { SettingsService } from "../settings-registry/settings.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { computeCyclePrice, resolveActivePlanPrice } from "./plan-pricing.util";
import { UpdatePlanDto } from "./dto/update-plan.dto";

/**
 * SRS §5.8/FR-8.2 (plan CRUD) + §5.7/FR-7.17 (groups/tiers as data). Scoped
 * narrowly to what Module 14 itself needs - the broader Admin Control Plane
 * completion module (17) owns the rest of FR-8.2's surrounding terminal UI.
 * Every price/name/limit here is founder-set data; adding or reordering a
 * tier is this CRUD, never a deploy.
 */
@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly auditLog: AuditLogService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Public pricing-page data - grouped and tier-ordered, active plans only
   * unless includeInactive. FR-7.19 - `mostPopular` is Settings-Registry-
   * driven (marketing.most_popular_individual_tier_order), never a
   * hard-coded tier name, so the founder can move the badge with no
   * deploy.
   */
  async listGrouped(includeInactive = false) {
    const plans = await this.prisma.plan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { tierOrder: "asc" }],
    });
    const mostPopularTierOrder = await this.settings.resolve<number>("marketing.most_popular_individual_tier_order");
    const withCycles = await Promise.all(
      plans.map(async (plan) => ({
        ...(await this.withCyclePrices(plan)),
        mostPopular: plan.planGroup === "individual" && plan.tierOrder === mostPopularTierOrder,
      })),
    );
    const groups: Record<string, typeof withCycles> = { individual: [], team: [], supplier: [] };
    for (const plan of withCycles) {
      groups[plan.planGroup].push(plan);
    }
    return groups;
  }

  async findById(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found.");
    return this.withCyclePrices(plan);
  }

  /** Module 61 (FR-7.21) - the pricing page's headline benefit block and Shopify comparison, entirely Settings Registry strings, never hard-coded in the frontend. */
  async getPricingCopy() {
    const [benefit1, benefit2, benefit3, shopifyComparison, sixMonthMultiplier, yearlyMultiplier] = await Promise.all([
      this.settings.resolve<string>("marketing.pricing_benefit_1"),
      this.settings.resolve<string>("marketing.pricing_benefit_2"),
      this.settings.resolve<string>("marketing.pricing_benefit_3"),
      this.settings.resolve<string>("marketing.pricing_shopify_comparison"),
      this.settings.resolve<number>("billing.six_month_price_multiplier"),
      this.settings.resolve<number>("billing.yearly_price_multiplier"),
    ]);
    return { benefits: [benefit1, benefit2, benefit3], shopifyComparison, sixMonthMultiplier, yearlyMultiplier };
  }

  /**
   * Module 61 (SRS §5.7, FR-7.20) - `activePrice` is the price actually
   * charged/shown right now (campaign-aware); `sixMonthPrice`/`yearlyPrice`
   * are that active price times the founder's fixed multipliers - all
   * derived data, never a second stored price. Supersedes the old
   * `yearlyDiscountPercent`-based computeYearlyPrice() for this purpose
   * (FR-7.6's admin-configurable-percent framing is retired here; the
   * column itself is left in the schema/plan-editor DTOs, unread by this
   * computation - a disclosed scope decision, see docs/build-plan.md).
   */
  private async withCyclePrices<T extends { price: unknown; campaignPrice: unknown; campaignActive: boolean; billingInterval: string }>(
    plan: T,
  ): Promise<T & { activePrice: number; sixMonthPrice: number | null; yearlyPrice: number | null }> {
    const activePrice = resolveActivePlanPrice(plan);
    if (plan.billingInterval !== "monthly") return { ...plan, activePrice, sixMonthPrice: null, yearlyPrice: null };

    const sixMonth = await this.settings.resolve<number>("billing.six_month_price_multiplier");
    const yearly = await this.settings.resolve<number>("billing.yearly_price_multiplier");
    return {
      ...plan,
      activePrice,
      sixMonthPrice: computeCyclePrice(activePrice, "six_month", { sixMonth, yearly }),
      yearlyPrice: computeCyclePrice(activePrice, "yearly", { sixMonth, yearly }),
    };
  }

  /** FR-7.17 - creates a new tier within a group at the given (or next-available) tierOrder. */
  async create(adminUserId: string, dto: CreatePlanDto) {
    if (dto.planGroup !== "team" && dto.seatPrice !== undefined) {
      throw new BadRequestException("seatPrice only applies to team-group tiers (FR-7.18).");
    }
    const tierOrder = dto.tierOrder ?? (await this.nextTierOrder(dto.planGroup));
    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        planGroup: dto.planGroup,
        tierOrder,
        seatPrice: dto.seatPrice,
        price: dto.price,
        regularPrice: dto.regularPrice,
        firstCyclePrice: dto.firstCyclePrice,
        campaignPrice: dto.campaignPrice,
        campaignActive: dto.campaignActive,
        currency: dto.currency ?? "PKR",
        billingInterval: dto.billingInterval,
        yearlyDiscountPercent: dto.yearlyDiscountPercent,
        sortOrder: dto.sortOrder ?? tierOrder,
      },
    });
    await this.auditLog.record({
      adminUserId,
      action: "plans.created",
      targetType: "plan",
      targetId: plan.id,
      afterValue: plan,
    });
    return plan;
  }

  /** FR-7.17 - editing a tier's price/name/order is a data operation; retiring never deletes it (existing subscribers stay put). */
  async update(adminUserId: string, planId: string, dto: UpdatePlanDto) {
    const before = await this.findById(planId);
    const after = await this.prisma.plan.update({
      where: { id: planId },
      data: {
        name: dto.name,
        tierOrder: dto.tierOrder,
        seatPrice: dto.seatPrice,
        price: dto.price,
        regularPrice: dto.regularPrice,
        firstCyclePrice: dto.firstCyclePrice,
        campaignPrice: dto.campaignPrice,
        campaignActive: dto.campaignActive,
        currency: dto.currency,
        billingInterval: dto.billingInterval,
        yearlyDiscountPercent: dto.yearlyDiscountPercent,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
    await this.auditLog.record({
      adminUserId,
      action: "plans.updated",
      targetType: "plan",
      targetId: planId,
      beforeValue: before,
      afterValue: after,
    });
    return after;
  }

  async retire(adminUserId: string, planId: string) {
    return this.update(adminUserId, planId, { isActive: false });
  }

  private async nextTierOrder(planGroup: $Enums.PlanGroup): Promise<number> {
    const top = await this.prisma.plan.findFirst({
      where: { planGroup },
      orderBy: { tierOrder: "desc" },
    });
    return (top?.tierOrder ?? -1) + 1;
  }
}
