import { PrismaClient } from "@prisma/client";

/**
 * Module 53 (SRS §5.60/FR-60.2) - return submission
 * (POST /storefront/order-status/:token/returns) is public and token-gated,
 * same "Phase B rate-limit re-audit" discipline already applied to reviews
 * (reviews.seed.ts) - a fresh rate limit setting, not a shared one, since
 * the two endpoints have unrelated abuse profiles.
 */
export async function seedReturnsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "returns.submission_rate_limit_per_hour" },
    create: {
      key: "returns.submission_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 1, max: 1000 },
      description: "Maximum POST .../returns calls per order-status token and per IP per hour.",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedReturnsSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Returns settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
