import { PrismaClient } from "@prisma/client";

/**
 * Module 8's Settings Registry keys (FR-4.3, FR-4.6) plus the `printify`
 * adapter registry row (FR-4.9) - admin-editable through the already-
 * generic Settings Registry admin API and the new supplier-adapters
 * registry endpoint, no new admin UI mechanism needed.
 */
export async function seedSupplierSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "suppliers.sync_poll_minutes" },
    create: {
      key: "suppliers.sync_poll_minutes",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 60,
      validation: { min: 5, max: 1440 },
      description: "How often the scheduled worker job re-syncs supplier price/stock (FR-4.3).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "suppliers.printify_default_shipping_cost" },
    create: {
      key: "suppliers.printify_default_shipping_cost",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 500,
      validation: { min: 0, max: 100000 },
      description: "Shown to the buyer for Printify-sourced listings (FR-4.6) - Printify's product API doesn't expose a per-product shipping cost.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "suppliers.printify_default_delivery_min_days" },
    create: {
      key: "suppliers.printify_default_delivery_min_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 7,
      validation: { min: 0, max: 90 },
      description: "Shown to the buyer for Printify-sourced listings (FR-4.6).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "suppliers.printify_default_delivery_max_days" },
    create: {
      key: "suppliers.printify_default_delivery_max_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 14,
      validation: { min: 0, max: 180 },
      description: "Shown to the buyer for Printify-sourced listings (FR-4.6).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "suppliers.printify_default_supported_countries" },
    create: {
      key: "suppliers.printify_default_supported_countries",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: ["PK"],
      description: "ISO country codes; checkout blocks against this once Module 9 exists (FR-4.7).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "suppliers.printify_default_shop_id" },
    create: {
      key: "suppliers.printify_default_shop_id",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "",
      description: "Placeholder for order forwarding/tracking (FR-3.4) - unused until Module 9 has a real order to forward.",
    },
    update: {},
  });

  await prisma.supplierAdapter.upsert({
    where: { adapterType: "printify" },
    create: { adapterType: "printify", displayName: "Printify", isEnabled: true },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedSupplierSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Supplier settings + printify adapter registry seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
