import { PrismaClient } from "@prisma/client";

/**
 * Module 58 (SRS §5.65, FR-65.5) - the advanced SEO fields (canonical URL,
 * robots directives, OG override, structured-data toggle, sitemap control,
 * custom slugs, custom head-tags) are Growth+ only; the pre-existing basic
 * per-item meta title/description stay available to every tier, unaffected
 * by this key. Same "entry tiers get false, higher tiers get a plan-scoped
 * override" mechanism as staff.max_accounts/data_export.on_demand_enabled.
 * Must run after seedPlansData() - the Growth/Pro plan rows it queries
 * must already exist.
 */
export async function seedSeoAdvancedSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "seo.advanced_fields_enabled" },
    create: {
      key: "seo.advanced_fields_enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan"],
      defaultValue: false,
      description:
        "Whether a seller may set the advanced SEO fields (canonical URL, robots directives, OG override, structured-data toggle, sitemap control, custom slugs, custom head-tags) - a Growth+ feature (FR-65.5); off by default below Growth. The basic seoTitle/seoDescription fields are never gated by this key.",
    },
    update: {},
  });

  const growthAndProPlans = await prisma.plan.findMany({
    where: { planGroup: "individual", tierOrder: { in: [2, 3] } },
  });
  for (const plan of growthAndProPlans) {
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "seo.advanced_fields_enabled", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "seo.advanced_fields_enabled", scopeType: "plan", scopeId: plan.id, value: true },
      update: { value: true },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedSeoAdvancedSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("SEO advanced-fields settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
