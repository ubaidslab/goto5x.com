import { PrismaClient } from "@prisma/client";

/**
 * Module 35's Settings Registry key (SRS §5.52/FR-52.5/52.6) - global
 * defaultValue 0 covers Free (and anything unlisted), same "Free gets
 * X, paid tiers get a plan-scoped override" mechanism as
 * branding.powered_by_removable (themes.seed.ts). Must run after
 * seedPlansData() - the paid plan rows it queries must already exist.
 */
export async function seedStaffSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "staff.max_accounts" },
    create: {
      key: "staff.max_accounts",
      valueType: "number",
      allowedScopes: ["global", "plan"],
      defaultValue: 0,
      validation: { min: 0 },
      description:
        "Max active staff sub-accounts a seller may create (FR-52.5); zero on Free by default (FR-52.6) - a paid-tier differentiator.",
    },
    update: {},
  });

  const maxAccountsByTier: Record<number, number> = { 1: 2, 2: 5, 3: 10 };
  const paidPlans = await prisma.plan.findMany({
    where: { planGroup: { in: ["individual", "team"] }, tierOrder: { gt: 0 } },
  });
  for (const plan of paidPlans) {
    const value = maxAccountsByTier[plan.tierOrder];
    if (value == null) continue;
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "staff.max_accounts", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "staff.max_accounts", scopeType: "plan", scopeId: plan.id, value },
      update: { value },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedStaffSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Staff accounts settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
