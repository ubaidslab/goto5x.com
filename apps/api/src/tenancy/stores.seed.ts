import { PrismaClient } from "@prisma/client";

/**
 * SRS §5.56/FR-56.1 - global defaultValue 1 (every seller can run at least
 * one store regardless of plan/tier, since a store is how a seller
 * operates at all - unlike staff.max_accounts, which is a pure paid-tier
 * add-on that entry tiers legitimately get zero of). Growth/Pro (and their
 * team-group equivalents) get a plan-scoped override. Must run after
 * seedPlansData() - the paid plan rows it queries must already exist.
 */
export async function seedStoresSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "stores.max_per_seller" },
    create: {
      key: "stores.max_per_seller",
      valueType: "number",
      allowedScopes: ["global", "plan", "seller"],
      defaultValue: 1,
      validation: { min: 1 },
      description:
        "Max stores a seller may own concurrently (FR-56.1). Every tier gets at least 1 - a store is how a seller operates, not a paid add-on the way staff seats are. Growth/Pro (and team-group equivalents) get a higher override.",
    },
    update: {},
  });

  // SRS §5.70/FR-70.2 (Global Launch Mandate) - the allowlist a new store's
  // currency picker is validated against, same "founder edits this without
  // a deploy" pattern as moderation.banned_keywords/dashboard.
  // personalization_allowed_themes. PKR (the pre-global-launch default) and
  // USD (the Paddle pricing ladder's own currency, §5.72) are the only two
  // currencies anything in this codebase has evidence of actually needing
  // at launch - extend this list, not CreateStoreDto, to add more.
  await prisma.settingsDefinition.upsert({
    where: { key: "stores.supported_currencies" },
    create: {
      key: "stores.supported_currencies",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: ["PKR", "USD"],
      description:
        "ISO-4217 codes a seller may choose as their new store's currency (FR-70.2). Display-only - UZEYN runs no FX conversion, so this is the full set of currencies a store can ever operate in, not a default that gets converted later.",
    },
    update: {},
  });

  // SRS §5.73 founder resolution (2026-10-04) - a store's slug has only
  // ever been checked for UNIQUENESS, never against a reserved-name list;
  // confirmed by direct investigation, not a pre-existing gate this just
  // documents. Global-only (not plan-scoped), since impersonation/
  // confusion risk is identical regardless of which tier claims it.
  await prisma.settingsDefinition.upsert({
    where: { key: "stores.reserved_slugs" },
    create: {
      key: "stores.reserved_slugs",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: [
        "admin",
        "api",
        "app",
        "www",
        "support",
        "help",
        "mail",
        "ftp",
        "billing",
        "status",
        "blog",
        "docs",
        "cdn",
        "static",
        "assets",
        "dashboard",
        "login",
        "signup",
        "auth",
        "payment",
        "paddle",
        "easypaisa",
        "jazzcash",
        "uzeyn",
      ],
      description: "Store slugs no seller may claim, regardless of plan - platform-own subdomains and payment-brand names a buyer could mistake for the real thing.",
    },
    update: {},
  });

  // SRS §5.93/FR-93.1 (D74, 2026-10-09) - "one store per customer for the
  // MVP window... every plan... is capped at stores = 1" - supersedes
  // Module 75/FR-7.23's GO 1/RUN 3/RISE 5/FLY 10 individual-tier ladder for
  // this window only (the ladder's own numbers stay canonical in SRS §5.6j
  // for whenever multi-store is reactivated; FR-93.1 is explicit that the
  // code is archived, not deleted). No individual-group override is seeded
  // anymore - the global default of 1 already applies to every individual
  // tier once the RUN/RISE/FLY overrides below are removed. Team group is
  // explicitly out of scope for D74 (mvp-scope.md never mentions it, and
  // every team/sponsorship e2e test already uses one store per sponsored
  // seller, never 2+ stores under one seller) - its own ladder is
  // untouched.
  const maxStoresByTierAndGroup: Record<"team", Record<number, number>> = {
    team: { 1: 2, 2: 5 },
  };
  const paidPlans = await prisma.plan.findMany({
    where: { planGroup: { in: ["individual", "team"] }, tierOrder: { gt: 0 } },
  });
  for (const plan of paidPlans) {
    if (plan.planGroup === "individual") {
      // Idempotent revert of a pre-FR-93.1 seed run's 3/5/10 override, if
      // one exists - deleteMany on a non-existent row is a safe no-op, so
      // this is correct whether or not an older override was ever written.
      await prisma.settingsValue.deleteMany({
        where: { definitionKey: "stores.max_per_seller", scopeType: "plan", scopeId: plan.id },
      });
      continue;
    }
    const value = maxStoresByTierAndGroup.team[plan.tierOrder];
    if (value == null) continue;
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "stores.max_per_seller", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "stores.max_per_seller", scopeType: "plan", scopeId: plan.id, value },
      update: { value },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedStoresSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Multi-store settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
