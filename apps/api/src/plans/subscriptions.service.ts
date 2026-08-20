import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaRuntimeService } from "../prisma/prisma-runtime.service";
import { AuditLogService } from "../admin/audit-log.service";
import type { SettingsContext } from "../settings-registry/settings.types";

/**
 * A billing-cycle-length step for FR-7.5's next-cycle math. Exported -
 * Module 20's PlanFeeDebitService reuses this for the exact same cadence
 * math rather than duplicating it. Module 61 (FR-7.20) added `six_month`
 * (advances 6 calendar months, covering the cycle a 5.5x-multiplier
 * payment buys) alongside the original monthly/yearly steps.
 */
export function addInterval(from: Date, interval: "monthly" | "six_month" | "yearly"): Date {
  const next = new Date(from);
  if (interval === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else if (interval === "six_month") next.setUTCMonth(next.getUTCMonth() + 6);
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
   * entry individual tier (tier 0, v0.33/FR-7.1/7.3, made a PERMANENT tier
   * by Module 61/FR-7.20): a real, tracked, paid first billing cycle -
   * there is no more Free Plan and no free trial. Module 61 retires the
   * old auto-transition-to-next-tier mechanism (no more pendingPlanId
   * queued here) - a seller who signs up on the entry tier may stay on it
   * indefinitely, same as any other tier, unless they explicitly request a
   * change via requestPlanChange(). Method name is deliberately
   * brand-agnostic (this tier has been renamed twice already - First
   * Month, then Basic, now GO per Module 74/v0.39 - see plans.seed.ts) so
   * a future rename never requires touching this call site again. The
   * signup-time discount is a global Settings-driven percentage off the
   * active price (Module 74, `billing.first_cycle_discount_percent`),
   * applied by WalletService's plan-fee-payment flow, not by this method.
   * `referralSource` (SRS FR-33.1) is captured here, once, since this is
   * the only place a Subscription row is ever created for a seller -
   * already-shape-validated by resolveReferralSource(), never re-validated
   * against a program table here since none exist yet (Module 22).
   */
  async assignEntryTierAtSignup(sellerId: string, referralSource: string | null = null): Promise<void> {
    const entryPlan = await this.prisma.plan.findFirst({
      where: { planGroup: "individual", tierOrder: 0 },
    });
    if (!entryPlan) {
      // Seeding failure, not a seller-facing condition - plans.seed.ts always
      // creates this row before the app accepts signups.
      throw new Error("No entry (individual, tier 0) plan exists - plans.seed.ts must run before signup.");
    }
    await this.prisma.subscription.create({
      data: {
        sellerId,
        planId: entryPlan.id,
        currentPeriodEnd: addInterval(new Date(), "monthly"),
        referralSource,
      },
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
   * yet (currentPeriodEnd null - e.g. a desponsored team member) has no
   * cycle to wait for, so the change applies now and starts a real cycle.
   * Every seller now gets a real currentPeriodEnd from signup (v0.33's
   * Basic), so this branch no longer fires for ordinary signups.
   * Disclosed decision (no explicit SRS text pins this edge case) - see
   * docs/build-plan.md's Module 14 note.
   *
   * Module 61 (FR-7.20) - `billingInterval`, when supplied, is written
   * immediately (never staged behind pendingPlanId): it only governs the
   * NEXT renewal's fee/multiplier and interval-advance, so unlike the tier
   * itself there is no mid-cycle proration concern to defer against.
   */
  async requestPlanChange(sellerId: string, newPlanId: string, billingInterval?: "monthly" | "six_month" | "yearly") {
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
          billingInterval,
          currentPeriodEnd: newPlan.billingInterval === "none" ? null : addInterval(new Date(), billingInterval ?? "monthly"),
        },
      });
    }

    return this.prisma.subscription.update({
      where: { sellerId },
      data: { pendingPlanId: newPlanId, billingInterval },
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

  /**
   * FR-7.13 - graceful downgrade, on a team member losing sponsorship, to
   * the fallback individual tier (tier 1 - v0.33: the entry PAID tier, now
   * that Free no longer exists) at the *current* period's end, whether
   * member-initiated or non-payment-triggered. Method name is deliberately
   * brand-agnostic (tier 1 has been "Starter", now "RUN" per Module
   * 74/v0.39 - see plans.seed.ts) so a future rename never requires
   * touching this call site again.
   */
  async scheduleDowngradeToFallbackTierAtPeriodEnd(sellerId: string): Promise<void> {
    const fallbackPlan = await this.prisma.plan.findFirst({ where: { planGroup: "individual", tierOrder: 1 } });
    if (!fallbackPlan) throw new Error("No fallback (individual, tier 1) plan exists.");
    const subscription = await this.prisma.subscription.findUnique({ where: { sellerId } });
    if (!subscription) throw new NotFoundException("No subscription found for this seller.");

    if (subscription.currentPeriodEnd === null) {
      // No cycle to wait for (e.g. a sponsored team member losing
      // sponsorship) - starts a real billing cycle on the fallback tier
      // immediately, same "nothing to defer" case requestPlanChange()
      // handles. This is what lets the seller flow through the ordinary
      // plan-fee-debit sweep (and, on non-payment,
      // WalletGraceLadderService's pause) like any other paid
      // subscription - no separate enforcement path needed.
      await this.prisma.subscription.update({
        where: { sellerId },
        data: {
          planId: fallbackPlan.id,
          pendingPlanId: null,
          sponsoredByTeamId: null,
          currentPeriodEnd: addInterval(new Date(), "monthly"),
        },
      });
      return;
    }
    await this.prisma.subscription.update({
      where: { sellerId },
      data: { pendingPlanId: fallbackPlan.id, sponsoredByTeamId: null },
    });
  }
}
