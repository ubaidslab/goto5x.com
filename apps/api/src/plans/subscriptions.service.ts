import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { AuditLogService } from "../admin/audit-log.service";
import type { SettingsContext } from "../settings-registry/settings.types";

/**
 * A billing-cycle-length step for FR-7.5's next-cycle math. v1.0 has only
 * monthly/yearly paid intervals. Exported - Module 20's PlanFeeDebitService
 * reuses this for the exact same cadence math rather than duplicating it.
 */
export function addInterval(from: Date, interval: "monthly" | "yearly"): Date {
  const next = new Date(from);
  if (interval === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

/**
 * SRS §5.7 (FR-7.1/7.5/7.8) - the piece that was missing platform-wide: a
 * real seller->plan assignment. Before this, settings.types.ts's
 * SettingsContext.planId existed but nothing ever populated it (see the
 * comment history on themes.seed.ts and sellers.dashboardTheme) - every
 * plan-scoped Settings Registry key silently fell through to its global
 * default for every seller. getPlanContext() is what every other module's
 * plan-gated check now calls instead of passing `{ sellerId }` alone.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaRuntimeService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Called once, from AuthService.signup() - every seller starts on the
   * Free (individual, tier 0) plan. `referralSource` (SRS FR-33.1) is
   * captured here, once, since this is the only place a Subscription row
   * is ever created for a seller - already-shape-validated by
   * resolveReferralSource(), never re-validated against a program table
   * here since none exist yet (Module 22).
   */
  async assignFreePlanAtSignup(sellerId: string, referralSource: string | null = null): Promise<void> {
    const freePlan = await this.prisma.plan.findFirst({
      where: { planGroup: "individual", tierOrder: 0 },
    });
    if (!freePlan) {
      // Seeding failure, not a seller-facing condition - plans.seed.ts always
      // creates this row before the app accepts signups.
      throw new Error("No Free (individual, tier 0) plan exists - plans.seed.ts must run before signup.");
    }
    await this.prisma.subscription.create({
      data: { sellerId, planId: freePlan.id, referralSource },
    });
  }

  /** Every other plan-gated check's entry point - merge this into whatever SettingsContext it already builds. */
  async getPlanContext(sellerId: string): Promise<SettingsContext> {
    const subscription = await this.prisma.subscription.findUnique({ where: { sellerId } });
    return { sellerId, planId: subscription?.planId };
  }

  /**
   * Module 20 (SRS FR-7.10 supplement) - the supplier-side equivalent,
   * closing the gap build-plan.md flagged since Module 14 ("Subscription
   * is seller-only... for the same reason [no supplier portal]").
   */
  async assignFreeSupplierPlanAtSignup(supplierId: string, referralSource: string | null = null): Promise<void> {
    const freePlan = await this.prisma.plan.findFirst({ where: { planGroup: "supplier", tierOrder: 0 } });
    if (!freePlan) {
      throw new Error("No Free (supplier, tier 0) plan exists - plans.seed.ts must run before signup.");
    }
    await this.prisma.subscription.create({ data: { supplierId, planId: freePlan.id, referralSource } });
  }

  async getSupplierSubscription(supplierId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { supplierId },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException("No subscription found for this supplier.");
    return subscription;
  }

  async getSupplierPlanContext(supplierId: string): Promise<SettingsContext> {
    const subscription = await this.prisma.subscription.findUnique({ where: { supplierId } });
    return { supplierId, planId: subscription?.planId };
  }

  /**
   * A supplier only ever has two tiers (Free/Premium, FR-7.10) with no
   * yearly option or mid-cycle-deferral rule to honor - unlike a seller's
   * requestPlanChange(), a supplier's change takes effect immediately.
   */
  async requestSupplierPlanChange(supplierId: string, newPlanId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { supplierId } });
    if (!subscription) throw new NotFoundException("No subscription found for this supplier.");
    const newPlan = await this.prisma.plan.findUnique({ where: { id: newPlanId } });
    if (!newPlan || !newPlan.isActive || newPlan.planGroup !== "supplier") {
      throw new BadRequestException("That plan is not available to suppliers.");
    }
    return this.prisma.subscription.update({
      where: { supplierId },
      data: {
        planId: newPlanId,
        currentPeriodEnd: newPlan.billingInterval === "none" ? null : addInterval(new Date(), newPlan.billingInterval),
      },
    });
  }

  async getSubscription(sellerId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { sellerId },
      include: { plan: true, pendingPlan: true },
    });
    if (!subscription) throw new NotFoundException("No subscription found for this seller.");
    return subscription;
  }

  /**
   * FR-7.5 - a plan change never applies immediately mid-cycle. The one
   * exception consistent with that same rule: a seller with no active cycle
   * yet (Free Plan, currentPeriodEnd null) has no cycle to wait for, so the
   * change applies now and starts a real cycle if the new plan is paid.
   * Disclosed decision (no explicit SRS text pins this edge case) - see
   * docs/build-plan.md's Module 14 note.
   */
  async requestPlanChange(sellerId: string, newPlanId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { sellerId } });
    if (!subscription) throw new NotFoundException("No subscription found for this seller.");
    const newPlan = await this.prisma.plan.findUnique({ where: { id: newPlanId } });
    if (!newPlan || !newPlan.isActive) throw new BadRequestException("That plan is not available.");
    if (newPlan.planGroup !== "individual") {
      throw new BadRequestException("A seller may only self-select an individual-group plan.");
    }

    if (subscription.currentPeriodEnd === null) {
      return this.prisma.subscription.update({
        where: { sellerId },
        data: {
          planId: newPlanId,
          pendingPlanId: null,
          currentPeriodEnd: newPlan.billingInterval === "none" ? null : addInterval(new Date(), newPlan.billingInterval),
        },
      });
    }

    return this.prisma.subscription.update({
      where: { sellerId },
      data: { pendingPlanId: newPlanId },
    });
  }

  /** Scheduled job (FR-7.5) - applies every due pending plan change at its cycle end, never early. */
  async applyDueCycleChanges(now = new Date()): Promise<{ applied: number }> {
    const due = await this.prisma.subscription.findMany({
      where: { pendingPlanId: { not: null }, currentPeriodEnd: { lte: now } },
      include: { pendingPlan: true },
    });

    let applied = 0;
    for (const subscription of due) {
      const newPlan = subscription.pendingPlan!;
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: newPlan.id,
          pendingPlanId: null,
          currentPeriodEnd: newPlan.billingInterval === "none" ? null : addInterval(subscription.currentPeriodEnd!, newPlan.billingInterval),
        },
      });
      applied += 1;
    }
    return { applied };
  }

  /** FR-7.8 - bypasses checkout entirely; always audit-logged with before/after plan. */
  async adminGrantPlan(adminUserId: string, sellerId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found.");

    const before = await this.prisma.subscription.findUnique({ where: { sellerId }, include: { plan: true } });
    if (!before) throw new NotFoundException("No subscription found for this seller.");

    const after = await this.prisma.subscription.update({
      where: { sellerId },
      data: { planId, pendingPlanId: null },
      include: { plan: true },
    });

    await this.auditLog.record({
      adminUserId,
      action: "plans.admin_granted",
      targetType: "subscription",
      targetId: after.id,
      beforeValue: { planId: before.planId, planName: before.plan.name },
      afterValue: { planId: after.planId, planName: after.plan.name },
    });

    return after;
  }

  /**
   * FR-7.18 - a newly-active team member's individual plan becomes whatever
   * the leader's Team tier grants: pointing planId directly at the Team
   * tier's own Plan row means every existing plan-gated check (developer
   * perks, dashboard personalization, commission laddering) resolves
   * correctly against it with no special-casing - only the addressing
   * changes, per FR-7.17. currentPeriodEnd stays null - billing for this
   * seat flows entirely through the leader's group invoice (FR-7.15), never
   * this member's own subscription cycle.
   */
  async sponsorMember(sellerId: string, teamId: string, teamPlanId: string): Promise<void> {
    await this.prisma.subscription.update({
      where: { sellerId },
      data: { planId: teamPlanId, sponsoredByTeamId: teamId, pendingPlanId: null, currentPeriodEnd: null },
    });
  }

  /** FR-7.13 - graceful downgrade to Free at the *current* period's end, whether member-initiated or non-payment-triggered. */
  async scheduleDowngradeToFreeAtPeriodEnd(sellerId: string): Promise<void> {
    const freePlan = await this.prisma.plan.findFirst({ where: { planGroup: "individual", tierOrder: 0 } });
    if (!freePlan) throw new Error("No Free (individual, tier 0) plan exists.");
    const subscription = await this.prisma.subscription.findUnique({ where: { sellerId } });
    if (!subscription) throw new NotFoundException("No subscription found for this seller.");

    if (subscription.currentPeriodEnd === null) {
      // No cycle to wait for (e.g. already effectively unsponsored) - same
      // "nothing to defer" case requestPlanChange() handles.
      await this.prisma.subscription.update({
        where: { sellerId },
        data: { planId: freePlan.id, pendingPlanId: null, sponsoredByTeamId: null, currentPeriodEnd: null },
      });
      return;
    }
    await this.prisma.subscription.update({
      where: { sellerId },
      data: { pendingPlanId: freePlan.id, sponsoredByTeamId: null },
    });
  }
}
