import { PrismaClient } from "@prisma/client";

/**
 * Phase B pre-launch audit finding (rate-limit re-audit) - the buyer-purchase
 * endpoint (POST /storefront/gift-cards/purchase, FR-49.2) is public and
 * unauthenticated; each call creates a `pending_payment` GiftCard row with
 * no prior rate limit beyond the generic 100/min IP throttle.
 */
export async function seedGiftCardsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "gift_cards.purchase_rate_limit_per_hour" },
    create: {
      key: "gift_cards.purchase_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 20,
      validation: { min: 1, max: 10000 },
      description: "Maximum POST /storefront/gift-cards/purchase calls per IP per hour.",
    },
    update: {},
  });

  // Module 75 (SRS §5.6j/FR-7.23) - gift cards were previously fully
  // ungated; new plan-scoped feature gate, off by default (global), on for
  // RISE+FLY - the same "advanced feature starts at RISE" boundary as
  // customer_segments.enabled/staff.max_accounts/premium templates/
  // D-Studio/team-leader eligibility elsewhere in this ladder. Gates
  // GiftCardsService.issue() (seller-issued cards) only, not the
  // buyer-purchase path - a store's own configuration already controls
  // whether buyers see a gift-card purchase option at all. Must run after
  // seedPlansData() - the paid plan rows it queries must already exist.
  await prisma.settingsDefinition.upsert({
    where: { key: "gift_cards.enabled" },
    create: {
      key: "gift_cards.enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan"],
      defaultValue: false,
      description: "Whether a seller's plan includes seller-issued gift cards (FR-7.23). Off by default; on for RISE+FLY.",
    },
    update: {},
  });

  const giftCardEligiblePlans = await prisma.plan.findMany({
    where: { planGroup: "individual", tierOrder: { gte: 2 } },
  });
  for (const plan of giftCardEligiblePlans) {
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "gift_cards.enabled", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "gift_cards.enabled", scopeType: "plan", scopeId: plan.id, value: true },
      update: { value: true },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedGiftCardsSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Gift cards settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
