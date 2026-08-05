import { PrismaClient } from "@prisma/client";

/**
 * Module 34's Settings Registry key (SRS §5.51/FR-51.2) - plan-tier
 * monthly email-campaign send quota. Same shape as catalog.product_limit
 * (ProductsService.create()'s precedent): numeric, plan-scoped, resolved
 * via SubscriptionsService.getPlanContext(sellerId).
 */
export async function seedCampaignsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "email_campaigns.monthly_send_limit" },
    create: {
      key: "email_campaigns.monthly_send_limit",
      valueType: "number",
      allowedScopes: ["global", "plan"],
      defaultValue: 500,
      validation: { min: 0 },
      description:
        "Max campaign emails a seller may send per calendar month, across all their stores (FR-51.2); a send that would exceed the remaining quota is blocked entirely before any email leaves.",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedCampaignsSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Email campaigns settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
