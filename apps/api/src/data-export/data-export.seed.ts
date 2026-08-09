import { PrismaClient } from "@prisma/client";

/**
 * Module 24 (SRS §5.36, FR-36.1) - the on-demand export's rate-limit
 * window. Module 56 (SRS §5.63, FR-63.2) - the Pro-tier gate on that same
 * on-demand path, same "entry tiers get false/zero, higher tiers get a
 * plan-scoped override" mechanism as staff.max_accounts. Must run after
 * seedPlansData() - the Pro plan row it queries must already exist.
 */
export async function seedDataExportSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "data_export.on_demand_min_interval_hours" },
    create: {
      key: "data_export.on_demand_min_interval_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 720 },
      description: "Minimum hours between a seller's own on-demand data export requests (FR-36.1) - prevents hammering Drive's API or the export job.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "data_export.on_demand_enabled" },
    create: {
      key: "data_export.on_demand_enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan"],
      defaultValue: false,
      description:
        "Whether a seller may request an on-demand full export (products+orders+customers+inventory bundle) themselves - a Pro-tier feature (FR-63.2); off by default for every plan below Pro. Subscription-renewal exports (the other trigger) are unaffected by this gate.",
    },
    update: {},
  });

  // Only Pro (individual, tierOrder 3) gets the on-demand export unlocked -
  // every other plan (including First Month/Starter/Growth) stays at the
  // false default above.
  const proPlan = await prisma.plan.findFirst({ where: { planGroup: "individual", tierOrder: 3 } });
  if (proPlan) {
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "data_export.on_demand_enabled", scopeType: "plan", scopeId: proPlan.id } },
      create: { definitionKey: "data_export.on_demand_enabled", scopeType: "plan", scopeId: proPlan.id, value: true },
      update: { value: true },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDataExportSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Data export settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
