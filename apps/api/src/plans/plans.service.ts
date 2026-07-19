import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { $Enums } from "@prisma/client";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { AuditLogService } from "../admin/audit-log.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { computeYearlyPrice } from "./plan-pricing.util";
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
  ) {}

  /** Public pricing-page data - grouped and tier-ordered, active plans only unless includeInactive. */
  async listGrouped(includeInactive = false) {
    const plans = await this.prisma.plan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { tierOrder: "asc" }],
    });
    const withYearly = plans.map(this.withYearlyPrice);
    const groups: Record<string, typeof withYearly> = { individual: [], team: [], supplier: [] };
    for (const plan of withYearly) {
      groups[plan.planGroup].push(plan);
    }
    return groups;
  }

  async findById(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found.");
    return this.withYearlyPrice(plan);
  }

  /** FR-7.6 - a monthly-priced tier's discounted annual price, derived data (never a second stored price). */
  private withYearlyPrice<T extends { price: unknown; yearlyDiscountPercent: unknown; billingInterval: string }>(
    plan: T,
  ): T & { yearlyPrice: number | null } {
    if (plan.billingInterval !== "monthly") return { ...plan, yearlyPrice: null };
    return { ...plan, yearlyPrice: computeYearlyPrice(Number(plan.price), plan.yearlyDiscountPercent as number | null) };
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
