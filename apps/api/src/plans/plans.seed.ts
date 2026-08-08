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
}

/**
 * FR-7.17 - the three v1.0 plan groups, each an ordered list of founder-set
 * tiers (mechanism only; prices/names/limits below are placeholder founder
 * data, editable from the plan editor with no deploy). Idempotent via the
 * (plan_group, tier_order) unique constraint - `update:` block only refreshes
 * price/regularPrice/yearlyDiscountPercent so an existing plan's own
 * founder-edited name/sortOrder is never clobbered by re-seeding.
 *
 * v0.33/FR-7.3/FR-7.19 - there is no more Free Plan. tierOrder 0 is now
 * "First Month", a real (paid, tracked) tier that every seller starts on -
 * it auto-transitions to Starter after one billing cycle
 * (SubscriptionsService's pendingPlanId sweep). Per-tier commission %,
 * product limit, and staff-account allowance below are the exact SRS
 * "Plans & Pricing" launch defaults - seeded as data, never hard-coded in
 * application logic.
 */
export async function seedPlansData(prisma: PrismaClient) {
  // v0.35/FR-6.30 - every per-plan commissionPercent override is now 0.
  // UZEYN is subscription-only; the commission engine stays fully intact
  // (LedgerService.accrueCommission() still runs, still posts a
  // commission_accrued entry - just for Rs. 0) and is re-activatable later
  // by an admin editing this per-plan override or the global default, not
  // a code change.
  const individualTiers = [
    { name: "First Month", tierOrder: 0, price: 1499, regularPrice: 5799, billingInterval: "monthly" as const, commissionPercent: 0, productLimit: 100 },
    { name: "Starter", tierOrder: 1, price: 5799, regularPrice: 6999, billingInterval: "monthly" as const, commissionPercent: 0, productLimit: 100 },
    { name: "Growth", tierOrder: 2, price: 14999, regularPrice: 17999, billingInterval: "monthly" as const, commissionPercent: 0, productLimit: 500 },
    { name: "Pro", tierOrder: 3, price: 27999, regularPrice: 34999, billingInterval: "monthly" as const, commissionPercent: 0, productLimit: 100_000 },
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
    seatPrice?: number;
    billingInterval: "monthly" | "yearly" | "none";
    yearlyDiscountPercent?: number;
  },
) {
  const shared = {
    price: data.price,
    regularPrice: data.regularPrice ?? null,
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
