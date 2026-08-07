import { PrismaClient } from "@prisma/client";

/**
 * Phase B pre-launch audit finding (rate-limit re-audit) - review submission
 * (POST /storefront/order-status/:token/reviews, FR-14.1) is public and
 * token-gated but had no rate limit of its own beyond the generic 100/min
 * IP throttle; once a token is known, nothing capped repeated submissions.
 */
export async function seedReviewsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "reviews.submission_rate_limit_per_hour" },
    create: {
      key: "reviews.submission_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 1, max: 1000 },
      description: "Maximum POST .../reviews calls per order-status token and per IP per hour.",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedReviewsSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Reviews settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
