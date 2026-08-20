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
      allowedScopes: ["global", "plan", "seller"],
      defaultValue: 500,
      validation: { min: 0 },
      description:
        "Max campaign emails a seller may send per calendar month, across all their stores (FR-51.2); a send that would exceed the remaining quota is blocked entirely before any email leaves.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "email_campaigns.create_rate_limit_per_hour" },
    create: {
      key: "email_campaigns.create_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 1, max: 1000 },
      description:
        "Maximum POST /campaigns calls per seller per hour (Phase B pre-launch audit finding - email_campaigns.monthly_send_limit bounds total volume but not burst/cadence; a full-quota send can otherwise fire in one call with no throttling of how often campaigns are created).",
    },
    update: {},
  });

  // Module 75 (SRS §5.6j/FR-7.23) - the founder-approved feature-gate
  // ladder: GO 799/RUN 2,499/RISE 10,000/FLY unlimited. FLY's "unlimited"
  // is represented as a very large sentinel (no real seller could plausibly
  // send this many campaign emails in a month) rather than teaching
  // EmailCampaignsService's plain-number quota math a distinct "unlimited"
  // concept. Must run after seedPlansData() - the paid plan rows it
  // queries must already exist.
  const EMAIL_CAMPAIGNS_UNLIMITED_SENTINEL = 1_000_000_000;
  const monthlyLimitByTierOrder: Record<number, number> = {
    0: 799,
    1: 2_499,
    2: 10_000,
    3: EMAIL_CAMPAIGNS_UNLIMITED_SENTINEL,
  };
  const individualPlans = await prisma.plan.findMany({ where: { planGroup: "individual" } });
  for (const plan of individualPlans) {
    const value = monthlyLimitByTierOrder[plan.tierOrder];
    if (value == null) continue;
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "email_campaigns.monthly_send_limit", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "email_campaigns.monthly_send_limit", scopeType: "plan", scopeId: plan.id, value },
      update: { value },
    });
  }
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
