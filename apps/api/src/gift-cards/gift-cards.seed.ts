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
