import { PrismaClient } from "@prisma/client";

/**
 * Module 11's real settings keys. `billing.commission_rate_percent` is
 * scoped seller/plan/global (per-category overrides aren't meaningful at
 * the whole-order level Module 11 accrues commission at - a multi-category
 * cart has no single category to key a per-category rate on) - see
 * docs/build-plan.md's Module 11 note on this simplification.
 */
export async function seedBillingSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.commission_rate_percent" },
    create: {
      key: "billing.commission_rate_percent",
      valueType: "number",
      allowedScopes: ["global", "plan", "seller"],
      // v0.39/v0.41 audit finding: every individual plan tier already sets
      // this to 0 at plan scope (plans.seed.ts), which is the normal
      // resolution path. But LedgerService.accrueCommission() resolves
      // against `subscription?.planId` - if a seller's Subscription row is
      // ever missing (not the normal path, but not impossible), scopeIdFor
      // has no plan id to match and resolution falls through past plan and
      // seller scope to this global default. Under the subscription-only,
      // commission-deactivated model (§5.6j) that fallback must never be
      // able to silently charge commission, so the default itself is 0, not
      // the pre-v0.39 value of 1.
      defaultValue: 0,
      validation: { min: 0, max: 2 },
      description: "Commission rate (%) accrued on each confirmed order's post-discount product+shipping subtotal (SRS FR-6.16). Hard-capped at 2% platform-wide (v0.33, FR-7.4 amended) - no scope, including a seller-specific override, can exceed it.",
      requiresConfirmation: true,
    },
    // Unlike every other definition in these seed files, this one refreshes
    // `validation` on every boot (not just `update: {}`) - the 2% cap is a
    // launch-blocker guarantee (v0.33, FR-7.4) that must retroactively
    // tighten an already-seeded environment's old max:100, not just apply
    // to fresh DBs. `requiresConfirmation` is refreshed the same way (FR-8.16,
    // v0.40) so an already-seeded environment retroactively picks up the
    // confirm-step protection, not just fresh DBs. `defaultValue` is
    // refreshed the same way now (v0.41 audit fix above) - an
    // already-seeded environment's stale default of 1 must be corrected to
    // 0 retroactively, not just for a fresh DB.
    update: {
      defaultValue: 0,
      validation: { min: 0, max: 2 },
      description: "Commission rate (%) accrued on each confirmed order's post-discount product+shipping subtotal (SRS FR-6.16). Hard-capped at 2% platform-wide (v0.33, FR-7.4 amended) - no scope, including a seller-specific override, can exceed it.",
      requiresConfirmation: true,
    },
  });

  /**
   * New (v0.41, founder request) - a narrower, admin-controlled pause than
   * `platform.maintenance_mode_enabled` (MaintenanceModeMiddleware): that
   * one blocks EVERY request platform-wide (existing sellers included).
   * This one blocks only what actually creates a NEW subscription - a new
   * seller's signup, and a first-cycle (never-yet-paid) plan-fee
   * submission - while an EXISTING seller's dashboard, stores, and
   * renewal payments continue completely normally. Use case: pausing new
   * sellers temporarily (capacity, travel, infra work) without taking the
   * whole platform down.
   */
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.new_subscriptions_paused" },
    create: {
      key: "billing.new_subscriptions_paused",
      valueType: "boolean",
      allowedScopes: ["global"],
      defaultValue: false,
      description: "When on, blocks new seller signups and a first-cycle (never-yet-paid) plan-fee submission - shows billing.new_subscriptions_paused_message on the pricing page and to a blocked signup/payment attempt. Existing sellers' dashboards, stores, and renewal payments are completely unaffected.",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.new_subscriptions_paused_message" },
    create: {
      key: "billing.new_subscriptions_paused_message",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "We're not accepting new sellers right now - please check back soon.",
      description: "The admin-editable message shown on the pricing page and to a blocked signup/first-cycle-payment attempt while billing.new_subscriptions_paused is on.",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.invoice_grace_period_days" },
    create: {
      key: "billing.invoice_grace_period_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 14,
      validation: { min: 1, max: 90 },
      description: "Days after an invoice's billing period ends before it's due, and before non-payment triggers automated store suspension (SRS FR-6.17/FR-6.18).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.invoice_generation_check_hours" },
    create: {
      key: "billing.invoice_generation_check_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description: "How often the monthly invoice-generation sweep checks for sellers needing a new invoice (idempotent - safe to run more often than monthly).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.invoice_overdue_sweep_hours" },
    create: {
      key: "billing.invoice_overdue_sweep_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description: "How often the grace-period sweep checks for overdue invoices to suspend (SRS FR-6.18).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });
}
