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
}
