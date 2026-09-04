import { PrismaClient } from "@prisma/client";

/**
 * FR-66.3 (Module 83, v0.56) - live chat widget, plan-gated RISE+FLY, the
 * same boundary as gift_cards.enabled/customer_segments.enabled. Must run
 * after seedPlansData() - the paid plan rows it queries must already exist.
 */
export async function seedBuyerChatSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "buyer_chat.enabled" },
    create: {
      key: "buyer_chat.enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan", "seller"],
      defaultValue: false,
      description: "Whether a seller's plan includes the live chat widget (FR-66.3). Off by default; on for RISE+FLY.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "buyer_chat.start_rate_limit_per_hour" },
    create: {
      key: "buyer_chat.start_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 30,
      validation: { min: 1 },
      description: "Max new chat threads a single IP may start per hour (Phase B rate-limit discipline - a public, unauthenticated row-creation endpoint).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "buyer_chat.away_after_minutes" },
    create: {
      key: "buyer_chat.away_after_minutes",
      valueType: "number",
      allowedScopes: ["global", "store"],
      defaultValue: 5,
      validation: { min: 1 },
      description: "Minutes with no seller reply to a buyer's last chat message before the widget shows a 'seller is away' state (FR-66.3).",
    },
    update: {},
  });

  const eligiblePlans = await prisma.plan.findMany({
    where: { planGroup: "individual", tierOrder: { gte: 2 } },
  });
  for (const plan of eligiblePlans) {
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "buyer_chat.enabled", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "buyer_chat.enabled", scopeType: "plan", scopeId: plan.id, value: true },
      update: { value: true },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedBuyerChatSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Buyer chat settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
