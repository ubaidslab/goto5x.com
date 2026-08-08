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
      defaultValue: 0,
      validation: { min: 0, max: 2 },
      description: "Commission rate (%) accrued on each confirmed order's post-discount product+shipping subtotal (SRS FR-6.16). Dormant at 0% platform-wide (v0.35, FR-6.30) - UZEYN is subscription-only until reactivated via this setting once a Pvt Ltd exists to receive it. Hard-capped at 2% (v0.33, FR-7.4) even when reactivated - no scope, including a seller-specific override, can exceed it.",
    },
    // Unlike every other definition in these seed files, this one refreshes
    // `defaultValue`/`validation` on every boot (not just `update: {}`) -
    // both the 2% cap (v0.33, FR-7.4) and the dormant-0% default (v0.35,
    // FR-6.30) are launch-blocker guarantees that must retroactively apply
    // to an already-seeded environment's old value, not just fresh DBs.
    update: {
      defaultValue: 0,
      validation: { min: 0, max: 2 },
      description: "Commission rate (%) accrued on each confirmed order's post-discount product+shipping subtotal (SRS FR-6.16). Dormant at 0% platform-wide (v0.35, FR-6.30) - UZEYN is subscription-only until reactivated via this setting once a Pvt Ltd exists to receive it. Hard-capped at 2% (v0.33, FR-7.4) even when reactivated - no scope, including a seller-specific override, can exceed it.",
    },
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
    },
    update: {},
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
    },
    update: {},
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
    },
    update: {},
  });
}
