import { PrismaClient } from "@prisma/client";

/**
 * Module 14 (SRS v0.19, §5.7/§5.23/§5.31) - every Settings Registry key this
 * module introduces. Plan-scoped feature gates that already existed before
 * Module 14 (billing.commission_rate_percent, theme.coded_mode_enabled) are
 * NOT re-declared here - they were seeded by their own module and only
 * needed a real seller->plan assignment to actually resolve, which
 * SubscriptionsService now provides.
 */
export async function seedPlansSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "catalog.product_limit" },
    create: {
      key: "catalog.product_limit",
      valueType: "number",
      allowedScopes: ["global", "plan"],
      defaultValue: 20,
      validation: { min: 0 },
      description: "Max products a store may create (FR-23.1); enforced at creation time, not a soft warning.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "catalog.storage_quota_bytes" },
    create: {
      key: "catalog.storage_quota_bytes",
      valueType: "number",
      allowedScopes: ["global", "plan"],
      defaultValue: 524_288_000, // 500 MB
      validation: { min: 0 },
      description: "Max total media_assets.size_bytes a store may hold (FR-23.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "lifecycle.dormant_warning_days" },
    create: {
      key: "lifecycle.dormant_warning_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 60,
      validation: { min: 1 },
      description: "Days a store may be inactive before the dormant-lifecycle warning email (FR-23.2).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "lifecycle.dormant_suspend_days" },
    create: {
      key: "lifecycle.dormant_suspend_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 90,
      validation: { min: 1 },
      description: "Days of inactivity (after the warning) before a dormant store is suspended (FR-23.2).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "lifecycle.dormant_archive_days" },
    create: {
      key: "lifecycle.dormant_archive_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 180,
      validation: { min: 1 },
      description: "Days of inactivity (after suspension) before a dormant store is archived - data retained, storefront permanently offline (FR-23.2).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "lifecycle.dormant_sweep_check_hours" },
    create: {
      key: "lifecycle.dormant_sweep_check_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description: "How often the dormant-store lifecycle sweep runs (FR-23.2) - idempotent, safe to run more often than the thresholds themselves require.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "finance.monthly_infra_cost" },
    create: {
      key: "finance.monthly_infra_cost",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 0,
      validation: { min: 0 },
      description: "Admin-entered monthly infra cost (PKR) for the unit-economics break-even view (FR-23.4) - never computed.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.launch_campaign_discount_percent" },
    create: {
      key: "billing.launch_campaign_discount_percent",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 0,
      validation: { min: 0, max: 100 },
      description: "Launch-campaign discount off commission_rate_percent, active only while expiry/seller-limit conditions hold (FR-7.7).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.launch_campaign_expiry" },
    create: {
      key: "billing.launch_campaign_expiry",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "",
      description: "ISO timestamp after which the launch campaign no longer applies; empty string = no expiry condition set (FR-7.7).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.launch_campaign_seller_limit" },
    create: {
      key: "billing.launch_campaign_seller_limit",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 0,
      validation: { min: 0 },
      description: "First-N-sellers counter condition for the launch campaign; 0 = no counter condition set (FR-7.7).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "teams.leader_eligible" },
    create: {
      key: "teams.leader_eligible",
      valueType: "boolean",
      allowedScopes: ["global", "plan"],
      defaultValue: false,
      description: "Whether a seller holding this resolved plan may create a team (FR-7.11); bundled with theme.coded_mode_enabled on the same qualifying tiers per FR-7.16.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "dashboard.personalization_allowed_themes" },
    create: {
      key: "dashboard.personalization_allowed_themes",
      valueType: "json",
      allowedScopes: ["global", "plan"],
      defaultValue: ["default"],
      description: "Dashboard theme/wallpaper ids this resolved plan may choose from (FR-28.4); the global default (any plan with no override) is the small built-in set.",
    },
    update: {},
  });

  // v0.33/FR-7.19 - which individual-group tierOrder gets the "Most
  // Popular" badge on the pricing page/plan editor - data, not a
  // hard-coded tier name, so the founder can move it with no deploy.
  // Launch default: Growth (tierOrder 2).
  await prisma.settingsDefinition.upsert({
    where: { key: "marketing.most_popular_individual_tier_order" },
    create: {
      key: "marketing.most_popular_individual_tier_order",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 2,
      validation: { min: 0 },
      description: "Which individual-group tierOrder gets the 'Most Popular' pricing-page badge (FR-7.19). Launch default: Growth.",
    },
    update: {},
  });

  // Module 61 (SRS §5.7, FR-7.20) - the founder's fixed-multiplier
  // billing-cycle model, replacing FR-7.6's admin-configurable-percent
  // yearly-discount framing. Both fixed multipliers off the active
  // monthly price - never a separately stored per-cycle price.
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.six_month_price_multiplier" },
    create: {
      key: "billing.six_month_price_multiplier",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 5.5,
      validation: { min: 0 },
      description: "A six-month subscription cycle bills this many times the active monthly price, for 6 months of service (FR-7.20).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.yearly_price_multiplier" },
    create: {
      key: "billing.yearly_price_multiplier",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 0 },
      description: "A yearly subscription cycle bills this many times the active monthly price, for 12 months of service (FR-7.20).",
    },
    update: {},
  });

  // Module 61 (FR-7.21) - the pricing page's headline benefit block,
  // corrected v0.36 to drop the retracted "0% commission" claim. Three
  // positioning points plus a one-line Shopify comparison, all Settings
  // Registry strings so the founder can edit copy with no deploy - never
  // hard-coded in the frontend.
  await prisma.settingsDefinition.upsert({
    where: { key: "marketing.pricing_benefit_1" },
    create: {
      key: "marketing.pricing_benefit_1",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "Buyer payments go straight to your own account",
      description: "Pricing page headline benefit, point 1 of 3 (FR-7.21).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "marketing.pricing_benefit_2" },
    create: {
      key: "marketing.pricing_benefit_2",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "Transparent low commission, as low as 1% - never a payment-processor markup on top",
      description: "Pricing page headline benefit, point 2 of 3 (FR-7.21).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "marketing.pricing_benefit_3" },
    create: {
      key: "marketing.pricing_benefit_3",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "Your money never sits with us",
      description: "Pricing page headline benefit, point 3 of 3 (FR-7.21).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "marketing.pricing_shopify_comparison" },
    create: {
      key: "marketing.pricing_shopify_comparison",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "Starter undercuts Shopify's Basic plan on both subscription fee and transaction commission - copy, not a live price feed.",
      description: "Pricing page's one-line comparison against Shopify's nearest equivalent tier (FR-7.21).",
    },
    update: {},
  });
}

/**
 * FR-7.17 - the three v1.0 plan groups, each an ordered list of founder-set
 * tiers (mechanism only; prices/names/limits below are placeholder founder
 * data, editable from the plan editor with no deploy). Idempotent via the
 * (plan_group, tier_order) unique constraint - `update:` block only refreshes
 * price/regularPrice/yearlyDiscountPercent so an existing plan's own
 * founder-edited name/sortOrder is never clobbered by re-seeding.
 *
 * Module 61 (SRS §5.7, FR-7.20) - four PERMANENT tiers: Basic, Starter,
 * Growth, Pro. Basic replaces the old "First Month" tier-level concept -
 * a seller who signs up on Basic may stay on it indefinitely (the old
 * auto-transition-to-Starter-at-cycle-end mechanism is retired;
 * SubscriptionsService.assignBasicPlanAtSignup() no longer queues a
 * pendingPlanId). The one-time signup discount that "First Month" used to
 * provide moves to a PER-TIER `firstCyclePrice` instead - whichever tier a
 * seller picks, their very first cycle bills at that tier's
 * firstCyclePrice, every cycle after at `price`. Launch defaults per
 * FR-7.20 v0.37 (lowered once commission was confirmed active alongside
 * subscription fees). Basic additionally seeds a `campaignPrice`
 * (inactive by default - an admin toggles `campaignActive` from the plan
 * editor when a campaign actually starts).
 */
export async function seedPlansData(prisma: PrismaClient) {
  const individualTiers = [
    {
      name: "Basic",
      tierOrder: 0,
      price: 2999,
      regularPrice: 3999,
      firstCyclePrice: 999,
      campaignPrice: 2499,
      billingInterval: "monthly" as const,
      commissionPercent: 2,
      productLimit: 100,
    },
    {
      name: "Starter",
      tierOrder: 1,
      price: 5299,
      regularPrice: 6499,
      firstCyclePrice: 1499,
      billingInterval: "monthly" as const,
      commissionPercent: 2,
      productLimit: 100,
    },
    {
      name: "Growth",
      tierOrder: 2,
      price: 13999,
      regularPrice: 16999,
      firstCyclePrice: 2999,
      billingInterval: "monthly" as const,
      commissionPercent: 1.5,
      productLimit: 500,
    },
    {
      name: "Pro",
      tierOrder: 3,
      price: 26999,
      regularPrice: 32999,
      firstCyclePrice: 4999,
      billingInterval: "monthly" as const,
      commissionPercent: 1,
      productLimit: 100_000,
    },
  ];
  for (const tier of individualTiers) {
    const { commissionPercent, productLimit, ...planFields } = tier;
    const plan = await upsertPlan(prisma, { planGroup: "individual", yearlyDiscountPercent: 16.67, ...planFields });
    await setPlanScopedSetting(prisma, "billing.commission_rate_percent", plan.id, commissionPercent);
    await setPlanScopedSetting(prisma, "catalog.product_limit", plan.id, productLimit);
  }

  // FR-7.18 - team tiers carry seatPrice (per sponsored seat), not `price`
  // for the leader's own subscription (v1.0: leader pays nothing extra to
  // hold a Team tier beyond whatever individual plan they're already on).
  // Unaffected by the v0.33 pricing rework - not one of the founder's
  // named launch-blocker tiers.
  const teamTiers = [
    { name: "Team Starter", tierOrder: 0, price: 0, seatPrice: 1000, billingInterval: "monthly" as const },
    { name: "Team Growth", tierOrder: 1, price: 0, seatPrice: 1500, billingInterval: "monthly" as const },
    { name: "Team Scale", tierOrder: 2, price: 0, seatPrice: 2000, billingInterval: "monthly" as const },
  ];
  for (const tier of teamTiers) {
    await upsertPlan(prisma, { planGroup: "team", ...tier });
  }

  // Supplier tiers are untouched by v0.33 - the supplier Free tier is a
  // separate, legitimate concept (FR-7.10) from the seller Free Plan that
  // was removed.
  const supplierTiers = [
    { name: "Supplier Free", tierOrder: 0, price: 0, billingInterval: "none" as const },
    { name: "Supplier Premium", tierOrder: 1, price: 2000, billingInterval: "monthly" as const },
  ];
  for (const tier of supplierTiers) {
    await upsertPlan(prisma, { planGroup: "supplier", ...tier });
  }
}

async function upsertPlan(
  prisma: PrismaClient,
  data: {
    planGroup: "individual" | "team" | "supplier";
    name: string;
    tierOrder: number;
    price: number;
    regularPrice?: number;
    firstCyclePrice?: number;
    campaignPrice?: number;
    seatPrice?: number;
    billingInterval: "monthly" | "yearly" | "none";
    yearlyDiscountPercent?: number;
  },
) {
  const shared = {
    price: data.price,
    regularPrice: data.regularPrice ?? null,
    firstCyclePrice: data.firstCyclePrice ?? null,
    campaignPrice: data.campaignPrice ?? null,
    seatPrice: data.seatPrice ?? null,
    billingInterval: data.billingInterval,
    yearlyDiscountPercent: data.yearlyDiscountPercent ?? null,
  };
  return prisma.plan.upsert({
    where: { uniq_plan_group_tier_order: { planGroup: data.planGroup, tierOrder: data.tierOrder } },
    create: {
      name: data.name,
      planGroup: data.planGroup,
      tierOrder: data.tierOrder,
      sortOrder: data.tierOrder,
      ...shared,
    },
    update: shared,
  });
}

/** Same plan-scoped upsert pattern as staff.seed.ts/themes.seed.ts's per-tier settings loops. */
async function setPlanScopedSetting(prisma: PrismaClient, definitionKey: string, planId: string, value: number) {
  await prisma.settingsValue.upsert({
    where: { uniq_settings_scope: { definitionKey, scopeType: "plan", scopeId: planId } },
    create: { definitionKey, scopeType: "plan", scopeId: planId, value },
    update: { value },
  });
}
