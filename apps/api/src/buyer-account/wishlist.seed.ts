import { PrismaClient } from "@prisma/client";

/**
 * FR-66.5 (Module 85, v0.58) - wishlist/save-for-later, plan-gated RISE+FLY,
 * the same boundary as buyer_chat.enabled/gift_cards.enabled/
 * customer_segments.enabled. Must run after seedPlansData() - the paid plan
 * rows it queries must already exist.
 */
export async function seedWishlistSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "wishlist.enabled" },
    create: {
      key: "wishlist.enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan", "seller"],
      defaultValue: false,
      description: "Whether a seller's plan includes wishlist/save-for-later (FR-66.5). Off by default; on for RISE+FLY.",
    },
    update: {},
  });

  const eligiblePlans = await prisma.plan.findMany({
    where: { planGroup: "individual", tierOrder: { gte: 2 } },
  });
  for (const plan of eligiblePlans) {
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "wishlist.enabled", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "wishlist.enabled", scopeType: "plan", scopeId: plan.id, value: true },
      update: { value: true },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedWishlistSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Wishlist settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
