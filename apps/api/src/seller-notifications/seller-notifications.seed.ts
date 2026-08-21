import { PrismaClient } from "@prisma/client";

/** Module 55 (SRS §5.62/FR-62.1) - the daily sales summary sweep's interval, same pattern as every other periodic-sweep Settings key (e.g. storehealth.recompute_interval_hours). */
export async function seedSellerNotificationsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "notifications.daily_sales_summary_interval_hours" },
    create: {
      key: "notifications.daily_sales_summary_interval_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description: "How often the daily sales summary email sweep runs (FR-62.1).",
    },
    update: {},
  });

  // Module 47 (SRS §5.47/FR-47.2) - the exact key names the FR names
  // verbatim. Whole numbers only (order counts are always whole numbers;
  // sales-amount thresholds are PKR, no fractional paisa in v1.0's money
  // handling elsewhere either).
  await prisma.settingsDefinition.upsert({
    where: { key: "milestones.order_count_thresholds" },
    create: {
      key: "milestones.order_count_thresholds",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: [1, 10, 50, 100, 500, 1000],
      description: "Confirmed-order-count thresholds (FR-47.2) - crossing one triggers a once-only in-dashboard milestone celebration (FR-47.3).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "milestones.sales_amount_thresholds" },
    create: {
      key: "milestones.sales_amount_thresholds",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: [10000, 100000, 500000, 1000000, 5000000],
      description: "Lifetime confirmed-sales (PKR) thresholds (FR-47.2) - crossing one triggers a once-only in-dashboard milestone celebration (FR-47.3).",
    },
    update: {},
  });
}
