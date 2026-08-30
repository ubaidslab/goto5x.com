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
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.launch_campaign_expiry" },
    create: {
      key: "billing.launch_campaign_expiry",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "",
      description: "ISO timestamp after which the launch campaign no longer applies; empty string = no expiry condition set (FR-7.7).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
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
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
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
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
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
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  // Module 74 (v0.39, SRS §5.6j FR-7.22) - replaces the retired per-plan
  // `firstCyclePrice` column: every tier's first-ever plan-fee payment
  // bills at this percentage off its standing `price` (campaign-aware,
  // via resolveActivePlanPrice()) - one global knob instead of an
  // individually-edited value per tier. See WalletService.
  // getPlanFeePaymentPreview()'s first-payment branch.
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.first_cycle_discount_percent" },
    create: {
      key: "billing.first_cycle_discount_percent",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 50,
      validation: { min: 0, max: 100 },
      description: "Percentage off the active price for a seller's very first plan-fee payment, every tier alike (FR-7.22) - replaces the retired per-plan firstCyclePrice column.",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
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

  // Module 74 (v0.39) - "as low as 1%" is corrected: commission is 0% on
  // every tier now (§5.6j, FR-6.51). A full copy/positioning rebuild is
  // Module 80's job (FR-7.24, "0% commission - keep every rupee you earn");
  // this is only the minimal accuracy fix so the default string isn't
  // false in the meantime.
  await prisma.settingsDefinition.upsert({
    where: { key: "marketing.pricing_benefit_2" },
    create: {
      key: "marketing.pricing_benefit_2",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "0% commission - keep every rupee you earn",
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
      // Module 80 (v0.39, FR-7.24) - the founder's exact positioning phrase.
      defaultValue: "Your money never sits with us - buyers pay you directly",
      description: "Pricing page headline benefit, point 3 of 3 (FR-7.21/FR-7.24).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "marketing.pricing_shopify_comparison" },
    create: {
      key: "marketing.pricing_shopify_comparison",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "RUN undercuts Shopify's Basic plan on both subscription fee and transaction commission - copy, not a live price feed.",
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
 * Module 74 (v0.39, SRS §5.6j FR-7.22) - four PERMANENT tiers, renamed and
 * repriced under the subscription-only model: GO/RUN/RISE/FLY (formerly
 * Basic/Starter/Growth/Pro, before that First Month/Starter/Growth/Pro -
 * kept deliberately brand-agnostic in code, see SubscriptionsService.
 * assignEntryTierAtSignup()). `firstCyclePrice` is DORMANT now - the
 * founder's directive made the first-cycle discount a single global
 * Settings-driven percentage off every tier's `price` uniformly
 * (`billing.first_cycle_discount_percent`, WalletService.
 * getPlanFeePaymentPreview()) rather than a per-tier stored value, so this
 * column is left unset (null) here - same "kept in schema, not deleted,
 * simply unread" treatment as the already-dormant `yearlyDiscountPercent`.
 */
export async function seedPlansData(prisma: PrismaClient) {
  const individualTiers = [
    {
      name: "GO",
      tierOrder: 0,
      price: 6499,
      regularPrice: 7999,
      billingInterval: "monthly" as const,
      commissionPercent: 0,
      productLimit: 100,
    },
    {
      name: "RUN",
      tierOrder: 1,
      price: 14999,
      regularPrice: 18999,
      billingInterval: "monthly" as const,
      commissionPercent: 0,
      productLimit: 100,
    },
    {
      name: "RISE",
      tierOrder: 2,
      price: 43999,
      regularPrice: 49999,
      billingInterval: "monthly" as const,
      commissionPercent: 0,
      productLimit: 500,
    },
    {
      name: "FLY",
      tierOrder: 3,
      price: 73999,
      regularPrice: 79999,
      billingInterval: "monthly" as const,
      commissionPercent: 0,
      productLimit: 100_000,
    },
  ];
  for (const tier of individualTiers) {
    const { commissionPercent, productLimit, ...planFields } = tier;
    const plan = await upsertPlan(prisma, { planGroup: "individual", yearlyDiscountPercent: 16.67, ...planFields });
    await setPlanScopedSetting(prisma, "billing.commission_rate_percent", plan.id, commissionPercent);
    await setPlanScopedSetting(prisma, "catalog.product_limit", plan.id, productLimit);

    // Module 75 (SRS §5.6j/FR-7.23) - closes the latent gap where
    // teams.leader_eligible/theme.coded_mode_enabled/theme.premium_tier_
    // enabled were all defined (by this file and themes.seed.ts/
    // external-api.seed.ts respectively) but never actually turned on for
    // any tier - every seller resolved all three to their global `false`
    // default. Turned on for RISE+FLY (tierOrder >= 2), same boundary as
    // gift_cards.enabled/customer_segments.enabled/staff.max_accounts.
    // Their VALUES are set here (not in their owning files) for the same
    // reason billing.commission_rate_percent's values already are above -
    // this loop is where the tier/plan.id pairing already exists.
    if (tier.tierOrder >= 2) {
      await setPlanScopedSetting(prisma, "teams.leader_eligible", plan.id, true);
      await setPlanScopedSetting(prisma, "theme.coded_mode_enabled", plan.id, true);
      await setPlanScopedSetting(prisma, "theme.premium_tier_enabled", plan.id, true);
      // Module 48 (SRS §5.55, FR-55.2/55.4) - "Growth tier and above," the
      // same RISE+FLY boundary as the three gates just above.
      await setPlanScopedSetting(prisma, "social_media.meta_catalog_feed_enabled", plan.id, true);
      await setPlanScopedSetting(prisma, "whatsapp.product_share_enabled", plan.id, true);
    }

    // Module 76 (SRS §5.6j/FR-6.52) - prepaid partial-advance verification,
    // free from RUN upward (tierOrder >= 1); same "set here, defined in the
    // owning module's seed file" idiom as the RISE+FLY gates just above.
    // Module 77 (FR-6.53) - WhatsApp verification, same RUN+ boundary
    // (email verification is never gated, on every tier including GO).
    if (tier.tierOrder >= 1) {
      await setPlanScopedSetting(prisma, "orders.prepaid_partial_advance_enabled", plan.id, true);
      await setPlanScopedSetting(prisma, "orders.whatsapp_verification_enabled", plan.id, true);
      // Module 95 (SRS §5.6l/FR-6.62) - "Prepaid" is the only store-wide
      // payment model gated by tier; COD and Advance are free on GO too.
      await setPlanScopedSetting(prisma, "payments.prepaid_model_enabled", plan.id, true);
    }
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
async function setPlanScopedSetting(prisma: PrismaClient, definitionKey: string, planId: string, value: number | boolean) {
  await prisma.settingsValue.upsert({
    where: { uniq_settings_scope: { definitionKey, scopeType: "plan", scopeId: planId } },
    create: { definitionKey, scopeType: "plan", scopeId: planId, value },
    update: { value },
  });
}
