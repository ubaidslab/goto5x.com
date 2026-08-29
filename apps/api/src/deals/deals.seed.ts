import { PrismaClient } from "@prisma/client";

/** SRS §5.67/FR-67.2 (Module 91) - the buy-now flow is public/unauthenticated, same rate-limit discipline as checkout/cart/gift-card-purchase. */
export async function seedDealsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "deals.buy_now_rate_limit_per_hour" },
    create: {
      key: "deals.buy_now_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 30,
      validation: { min: 1, max: 10000 },
      description: "Maximum POST /storefront/deals/:dealId/buy-now calls per IP per hour.",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDealsSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Deals settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
