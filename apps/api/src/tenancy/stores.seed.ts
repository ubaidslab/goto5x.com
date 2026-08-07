import { PrismaClient } from "@prisma/client";

/**
 * SRS §5.56/FR-56.1 - global defaultValue 1 (every seller can run at least
 * one store regardless of plan/tier, since a store is how a seller
 * operates at all - unlike staff.max_accounts, which is a pure paid-tier
 * add-on that entry tiers legitimately get zero of). Growth/Pro (and their
 * team-group equivalents) get a plan-scoped override. Must run after
 * seedPlansData() - the paid plan rows it queries must already exist.
 */
export async function seedStoresSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "stores.max_per_seller" },
    create: {
      key: "stores.max_per_seller",
      valueType: "number",
      allowedScopes: ["global", "plan"],
      defaultValue: 1,
      validation: { min: 1 },
      description:
        "Max stores a seller may own concurrently (FR-56.1). Every tier gets at least 1 - a store is how a seller operates, not a paid add-on the way staff seats are. Growth/Pro (and team-group equivalents) get a higher override.",
    },
    update: {},
  });

  // Individual: First Month/Starter keep the global default of 1 (no
  // override needed). Growth gets 2, Pro gets 5 (founder-specified range
  // was 3-5; 5 chosen as the launch ceiling). Team group mirrors the same
  // shape by tierOrder position (Team Starter implicitly 1 via the global
  // default, Team Growth 2, Team Scale 5).
  const maxStoresByTierAndGroup: Record<"individual" | "team", Record<number, number>> = {
    individual: { 2: 2, 3: 5 },
    team: { 1: 2, 2: 5 },
  };
  const paidPlans = await prisma.plan.findMany({
    where: { planGroup: { in: ["individual", "team"] }, tierOrder: { gt: 0 } },
  });
  for (const plan of paidPlans) {
    const value = maxStoresByTierAndGroup[plan.planGroup as "individual" | "team"]?.[plan.tierOrder];
    if (value == null) continue;
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "stores.max_per_seller", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "stores.max_per_seller", scopeType: "plan", scopeId: plan.id, value },
      update: { value },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedStoresSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Multi-store settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
