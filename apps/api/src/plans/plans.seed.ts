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
      description: "Days a Free-Plan store may be inactive before the dormant-lifecycle warning email (FR-23.2).",
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
      description: "Days of inactivity (after the warning) before a dormant Free-Plan store is suspended (FR-23.2).",
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
    where: { key: "plans.free_store_limit_per_identity" },
    create: {
      key: "plans.free_store_limit_per_identity",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 1,
      validation: { min: 1 },
      description: "Max Free-Plan stores one verified identity (cnic_hash) may create (FR-23.5).",
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
      description: "Dashboard theme/wallpaper ids this resolved plan may choose from (FR-28.4); the Free Plan's global default is the small built-in set.",
    },
    update: {},
  });
}

/**
 * FR-7.17 - the three v1.0 plan groups, each an ordered list of founder-set
 * tiers (mechanism only; prices/names/limits below are placeholder founder
 * data, editable from the plan editor with no deploy). Idempotent via the
 * (plan_group, tier_order) unique constraint.
 */
export async function seedPlansData(prisma: PrismaClient) {
  const individualTiers = [
    { name: "Free", tierOrder: 0, price: 0, billingInterval: "none" as const },
    { name: "Starter", tierOrder: 1, price: 1500, billingInterval: "monthly" as const },
    { name: "Standard", tierOrder: 2, price: 3500, billingInterval: "monthly" as const },
    { name: "Pro", tierOrder: 3, price: 7000, billingInterval: "monthly" as const },
  ];
  for (const tier of individualTiers) {
    await upsertPlan(prisma, { planGroup: "individual", ...tier });
  }

  // FR-7.18 - team tiers carry seatPrice (per sponsored seat), not `price`
  // for the leader's own subscription (v1.0: leader pays nothing extra to
  // hold a Team tier beyond whatever individual plan they're already on).
  const teamTiers = [
    { name: "Team Starter", tierOrder: 0, price: 0, seatPrice: 1000, billingInterval: "monthly" as const },
    { name: "Team Growth", tierOrder: 1, price: 0, seatPrice: 1500, billingInterval: "monthly" as const },
    { name: "Team Scale", tierOrder: 2, price: 0, seatPrice: 2000, billingInterval: "monthly" as const },
  ];
  for (const tier of teamTiers) {
    await upsertPlan(prisma, { planGroup: "team", ...tier });
  }

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
    seatPrice?: number;
    billingInterval: "monthly" | "yearly" | "none";
  },
) {
  const existing = await prisma.plan.findFirst({
    where: { planGroup: data.planGroup, tierOrder: data.tierOrder },
  });
  if (existing) return existing;
  return prisma.plan.create({
    data: {
      name: data.name,
      planGroup: data.planGroup,
      tierOrder: data.tierOrder,
      price: data.price,
      seatPrice: data.seatPrice ?? null,
      billingInterval: data.billingInterval,
      sortOrder: data.tierOrder,
    },
  });
}
