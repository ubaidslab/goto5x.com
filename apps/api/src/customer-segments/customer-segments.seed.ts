import { PrismaClient } from "@prisma/client";

/**
 * Module 75 (SRS §5.6j/FR-7.23) - customer segments were previously fully
 * ungated; new plan-scoped feature gate, off by default (global), on for
 * RISE+FLY - the same "advanced feature starts at RISE" boundary as
 * gift_cards.enabled/staff.max_accounts/premium templates/D-Studio/
 * team-leader eligibility elsewhere in this ladder. Must run after
 * seedPlansData() - the paid plan rows it queries must already exist.
 */
export async function seedCustomerSegmentsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "customer_segments.enabled" },
    create: {
      key: "customer_segments.enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan", "seller"],
      defaultValue: false,
      description: "Whether a seller's plan includes customer segments (FR-7.23). Off by default; on for RISE+FLY.",
    },
    update: {},
  });

  const eligiblePlans = await prisma.plan.findMany({
    where: { planGroup: "individual", tierOrder: { gte: 2 } },
  });
  for (const plan of eligiblePlans) {
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "customer_segments.enabled", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "customer_segments.enabled", scopeType: "plan", scopeId: plan.id, value: true },
      update: { value: true },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedCustomerSegmentsSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Customer segments settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
