import { PrismaClient } from "@prisma/client";

/**
 * Module 35's Settings Registry key (SRS §5.52/FR-52.5/52.6) - global
 * defaultValue 0 covers any plan with no override, same "entry tiers get
 * zero, higher tiers get a plan-scoped override" mechanism as
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

  // Module 97 (SRS §5.52/FR-52.10) - how often the expiry sweep checks for
  // past-expiry staff accounts to revoke. Same "global-only, admin-tunable
  // cadence" shape as every other sweep's own *_sweep_check_hours key.
  await prisma.settingsDefinition.upsert({
    where: { key: "staff.expiry_sweep_check_hours" },
    create: {
      key: "staff.expiry_sweep_check_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 1,
      validation: { min: 1 },
      description: "How often (hours) the sweep checks for staff accounts past their expiresAt and revokes them (FR-52.10).",
    },
    update: {},
  });

  // Module 97 (SRS §5.52/FR-52.13, founder batch "Staff Accounts
  // Overhaul") - corrected against the real GO(0)/RUN(1)/RISE(2)/FLY(3)
  // individual-tier progression: GO 0 (unset, falls through to the
  // global default above) - RUN 2 - RISE 3 - FLY 5. Previously RUN was
  // unset (0) and FLY was 10; FLY is a deliberate decrease, confirmed by
  // the founder as safe pre-launch (no seller has legitimately held more
  // than 5 under the old default yet) - existing accounts above the new
  // cap are never revoked by this change, only new creation is blocked
  // (same "never retroactively revoke, only block new" precedent as
  // catalog.product_limit). Team-group tiers are untouched, unaffected
  // by this correction - kept at their own separate mapping.
  const maxAccountsByTierAndGroup: Record<"individual" | "team", Record<number, number>> = {
    individual: { 1: 2, 2: 3, 3: 5 },
    team: { 1: 2, 2: 5 },
  };
  const paidPlans = await prisma.plan.findMany({
    where: { planGroup: { in: ["individual", "team"] }, tierOrder: { gt: 0 } },
  });
  for (const plan of paidPlans) {
    const value = maxAccountsByTierAndGroup[plan.planGroup as "individual" | "team"]?.[plan.tierOrder];
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
