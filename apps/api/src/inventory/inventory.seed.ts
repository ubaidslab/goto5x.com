import { PrismaClient } from "@prisma/client";

/** Module 28's Settings Registry key (SRS §5.39, FR-39.2). */
export async function seedInventorySettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "inventory.low_stock_threshold" },
    create: {
      key: "inventory.low_stock_threshold",
      valueType: "number",
      allowedScopes: ["store", "global"],
      defaultValue: 5,
      validation: { min: 0 },
      description: "A variant at or below this stock quantity is flagged as low-stock on the Inventory screen (FR-39.2).",
    },
    update: {},
  });
}
