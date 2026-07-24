import { Injectable } from "@nestjs/common";
import { PrismaAdminService } from "../prisma/prisma-admin.service";
import { SettingsService } from "../settings-registry/settings.service";
import { hasAnyPaymentMethod } from "../store-settings/payment-instructions.service";

export interface StoreHealthInputBreakdown {
  key: string;
  label: string;
  weight: number;
  /** 0-1, 1 = perfect on this input. */
  fraction: number;
  /** This input's actual contribution to the final 0-100 score. */
  contribution: number;
  /** Present only when this input is dragging the score down - the plain-language suggestion (FR-34.3). */
  suggestion?: string;
}

export interface StoreHealthResult {
  score: number;
  breakdown: StoreHealthInputBreakdown[];
}

function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * SRS §5.34, FR-34.1-34.3. Computes a 0-100 composite score for one store
 * entirely from data this SRS already collects elsewhere - the only new
 * field this module adds is `Store.policyText` (the one disclosed schema
 * gap FR-34.1 itself calls out).
 *
 * Score = 100 * (sum of weight_i * fraction_i) / (sum of weight_i) - dividing
 * by the ACTUAL sum of the (Settings-Registry-editable) weights, not
 * assuming they add up to exactly 100, so an admin tweaking one weight
 * without rebalancing the rest can never silently push the score out of
 * the 0-100 bound.
 */
@Injectable()
export class StoreHealthScoreService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly settings: SettingsService,
  ) {}

  async computeForStore(storeId: string, now = new Date()): Promise<StoreHealthResult> {
    const [
      weightFulfillment,
      weightCancellation,
      weightPendingForever,
      weightDisputes,
      weightProfile,
      weightAccountAge,
      weightModerationRisk,
      fulfillmentTargetDays,
      windowDays,
      staleDays,
      accountAgeReferenceMonths,
    ] = await Promise.all([
      this.settings.resolve<number>("storehealth.weight_fulfillment"),
      this.settings.resolve<number>("storehealth.weight_cancellation"),
      this.settings.resolve<number>("storehealth.weight_pending_forever"),
      this.settings.resolve<number>("storehealth.weight_disputes"),
      this.settings.resolve<number>("storehealth.weight_profile_completeness"),
      this.settings.resolve<number>("storehealth.weight_account_age"),
      this.settings.resolve<number>("storehealth.weight_moderation_risk"),
      this.settings.resolve<number>("storehealth.fulfillment_target_days"),
      this.settings.resolve<number>("storehealth.trailing_window_days"),
      this.settings.resolve<number>("storehealth.stale_pending_days"),
      this.settings.resolve<number>("storehealth.account_age_reference_months"),
    ]);

    const store = await this.prismaAdmin.store.findUniqueOrThrow({
      where: { id: storeId },
      include: { seller: true, paymentInstructions: true, logoMedia: true },
    });

    const windowCutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const orders = await this.prismaAdmin.order.findMany({
      where: { storeId, placedAt: { gte: windowCutoff } },
      select: { id: true, status: true, placedAt: true },
    });
    const total = orders.length;

    // --- 1. On-time fulfillment rate ---------------------------------
    const shippedOrders = orders.filter((o) => o.status === "shipped" || o.status === "delivered" || o.status === "completed");
    let fulfillmentFraction = 1; // no shipped orders yet - neutral (never penalized for having no volume)
    let onTimeCount = 0;
    let measuredCount = 0;
    if (shippedOrders.length > 0) {
      const events = await this.prismaAdmin.orderTimelineEvent.findMany({
        where: { orderId: { in: shippedOrders.map((o) => o.id) }, eventType: "status_changed" },
        select: { orderId: true, afterValue: true, createdAt: true },
      });
      const byOrder = new Map<string, { confirmedAt?: Date; shippedAt?: Date }>();
      for (const e of events) {
        const status = (e.afterValue as { status?: string } | null)?.status;
        if (status !== "confirmed" && status !== "shipped") continue;
        const entry = byOrder.get(e.orderId) ?? {};
        if (status === "confirmed") entry.confirmedAt = e.createdAt;
        if (status === "shipped") entry.shippedAt = e.createdAt;
        byOrder.set(e.orderId, entry);
      }
      for (const [, times] of byOrder) {
        if (!times.confirmedAt || !times.shippedAt) continue;
        measuredCount += 1;
        const days = (times.shippedAt.getTime() - times.confirmedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (days <= fulfillmentTargetDays) onTimeCount += 1;
      }
      if (measuredCount > 0) fulfillmentFraction = onTimeCount / measuredCount;
    }

    // --- 2. Cancellation rate -----------------------------------------
    const cancellationRate = total > 0 ? orders.filter((o) => o.status === "cancelled").length / total : 0;
    const cancellationFraction = clamp01(1 - cancellationRate);

    // --- 3. Pending-forever rate ----------------------------------------
    const staleCutoff = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);
    const pendingForeverCount = orders.filter((o) => o.status === "pending" && o.placedAt < staleCutoff).length;
    const pendingForeverRate = total > 0 ? pendingForeverCount / total : 0;
    const pendingForeverFraction = clamp01(1 - pendingForeverRate);

    // --- 4. Dispute/refund signals ----------------------------------
    // `commission_waived` ledger entries against this store's orders in the
    // window (FR-6.20's commission-dispute mechanism) plus orders sitting at
    // `disputed` status (FR-6.5) - both existing signals, no new tracking.
    const disputedOrderCount = orders.filter((o) => o.status === "disputed").length;
    const waivedCount = await this.prismaAdmin.ledgerEntry.count({
      where: { type: "commission_waived", order: { storeId }, createdAt: { gte: windowCutoff } },
    });
    const disputeRate = total > 0 ? (disputedOrderCount + waivedCount) / total : 0;
    const disputeFraction = clamp01(1 - disputeRate);

    // --- 5. Profile completeness --------------------------------------
    const completenessChecks = [
      Boolean(store.logoMediaId),
      Boolean(store.paymentInstructions && hasAnyPaymentMethod(store.paymentInstructions)),
      Boolean(store.seller.cnicEncrypted),
      Boolean(store.policyText && store.policyText.trim().length > 0),
    ];
    const completenessFraction = completenessChecks.filter(Boolean).length / completenessChecks.length;

    // --- 6. Account age (capped, never dominates) -----------------------
    const ageMonths = monthsBetween(store.seller.createdAt, now);
    const accountAgeFraction = clamp01(ageMonths / accountAgeReferenceMonths);

    // --- 7. Moderation/risk history (reuses §5.30's engine directly) ----
    const riskFraction = clamp01(1 - (store.seller.riskScore ?? 0) / 100);
    const moderationRiskFraction = store.seller.lifecycleStatus === "active" ? riskFraction : 0;

    const inputs: StoreHealthInputBreakdown[] = [
      {
        key: "fulfillment",
        label: "On-time fulfillment",
        weight: weightFulfillment,
        fraction: fulfillmentFraction,
        contribution: 0,
        suggestion:
          measuredCount > 0 && fulfillmentFraction < 0.8
            ? `${measuredCount - onTimeCount} of ${measuredCount} recent orders shipped later than the ${fulfillmentTargetDays}-day target - ship orders sooner to improve this.`
            : undefined,
      },
      {
        key: "cancellation",
        label: "Cancellation rate",
        weight: weightCancellation,
        fraction: cancellationFraction,
        contribution: 0,
        suggestion: cancellationRate > 0.1 ? `${Math.round(cancellationRate * 100)}% of recent orders were cancelled - review why orders are being cancelled.` : undefined,
      },
      {
        key: "pending_forever",
        label: "Stale pending orders",
        weight: weightPendingForever,
        fraction: pendingForeverFraction,
        contribution: 0,
        suggestion:
          pendingForeverCount > 0
            ? `${pendingForeverCount} order(s) have been pending for over ${staleDays} days - mark them shipped or cancel them to improve this.`
            : undefined,
      },
      {
        key: "disputes",
        label: "Disputes & refunds",
        weight: weightDisputes,
        fraction: disputeFraction,
        contribution: 0,
        suggestion: disputedOrderCount + waivedCount > 0 ? `${disputedOrderCount + waivedCount} order(s) had a dispute or commission waiver recently - resolving disputes quickly improves this.` : undefined,
      },
      {
        key: "profile_completeness",
        label: "Store profile completeness",
        weight: weightProfile,
        fraction: completenessFraction,
        contribution: 0,
        suggestion: completenessFraction < 1 ? this.completenessSuggestion(completenessChecks) : undefined,
      },
      {
        key: "account_age",
        label: "Account age",
        weight: weightAccountAge,
        fraction: accountAgeFraction,
        contribution: 0,
      },
      {
        key: "moderation_risk",
        label: "Moderation & risk history",
        weight: weightModerationRisk,
        fraction: moderationRiskFraction,
        contribution: 0,
        suggestion:
          moderationRiskFraction < 0.8
            ? store.seller.lifecycleStatus !== "active"
              ? "Your account currently has a Trust & Safety restriction in effect - resolving it will improve this."
              : "Your account's risk score is elevated - keeping order/dispute history clean will improve this."
            : undefined,
      },
    ];

    const weightSum = inputs.reduce((sum, i) => sum + i.weight, 0) || 1;
    for (const input of inputs) {
      input.contribution = (input.weight * input.fraction * 100) / weightSum;
    }
    const score = Math.round(inputs.reduce((sum, i) => sum + i.contribution, 0));

    return { score: Math.min(100, Math.max(0, score)), breakdown: inputs };
  }

  private completenessSuggestion(checks: boolean[]): string {
    const missing: string[] = [];
    if (!checks[0]) missing.push("upload a store logo");
    if (!checks[1]) missing.push("configure at least one payment method");
    if (!checks[2]) missing.push("complete CNIC verification");
    if (!checks[3]) missing.push("add a store policy statement");
    return `Your store profile is incomplete - ${missing.join(", ")} to improve this.`;
  }

  /** FR-34.2 - one history row per run; idempotent/safe to re-run (recomputing never has a side effect beyond writing this row). */
  async recomputeAndRecord(storeId: string, now = new Date()): Promise<StoreHealthResult> {
    const result = await this.computeForStore(storeId, now);
    await this.prismaAdmin.storeHealthScoreHistory.create({
      data: { storeId, score: result.score, breakdown: result.breakdown as unknown as object, computedAt: now },
    });
    return result;
  }

  /** FR-34.2 - the scheduled sweep: every active-or-orders_paused store, one history row each. */
  async runSweep(now = new Date()): Promise<{ recomputed: number }> {
    const stores = await this.prismaAdmin.store.findMany({
      where: { status: { in: ["active", "orders_paused"] } },
      select: { id: true },
    });
    for (const store of stores) {
      await this.recomputeAndRecord(store.id, now);
    }
    return { recomputed: stores.length };
  }

  async latestForStore(storeId: string) {
    return this.prismaAdmin.storeHealthScoreHistory.findFirst({
      where: { storeId },
      orderBy: { computedAt: "desc" },
    });
  }

  async historyForStore(storeId: string, limit = 30) {
    return this.prismaAdmin.storeHealthScoreHistory.findMany({
      where: { storeId },
      orderBy: { computedAt: "desc" },
      take: limit,
    });
  }
}
