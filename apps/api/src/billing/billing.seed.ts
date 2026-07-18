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
      defaultValue: 1,
      validation: { min: 0, max: 100 },
      description: "Commission rate (%) accrued on each confirmed order's post-discount product+shipping subtotal (SRS FR-6.16).",
    },
    update: {},
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
