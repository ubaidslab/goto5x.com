import { PrismaClient } from "@prisma/client";

/**
 * Module 22 (SRS §5.33, FR-33.5-33.7/33.9) - every tunable business
 * constant for the Growth & Partner Programs referral engine, expressed as
 * Settings Registry values, same idiom as every other module's *.seed.ts.
 */
export async function seedGrowthProgramsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "growth.ambassador_eligible" },
    create: {
      key: "growth.ambassador_eligible",
      valueType: "boolean",
      allowedScopes: ["global", "plan"],
      defaultValue: false,
      description:
        "Whether a seller holding this resolved plan may apply to the Certified Ambassador program (FR-33.5). Global default is false - an admin opts specific paid tiers in.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.ambassador_commission_percent" },
    create: {
      key: "growth.ambassador_commission_percent",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 8,
      validation: { min: 0, max: 100 },
      description: "Ambassador referral commission (%) of a referred seller's paid plan-subscription amount (FR-33.5).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.ambassador_commission_window_months" },
    create: {
      key: "growth.ambassador_commission_window_months",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 6,
      validation: { min: 1, max: 60 },
      description: "How many months of a referred seller's plan-subscription payments earn Ambassador commission (FR-33.5) - locked in per-attribution at the moment of attribution.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.ambassador_monthly_reward_threshold_subscriptions" },
    create: {
      key: "growth.ambassador_monthly_reward_threshold_subscriptions",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 12,
      validation: { min: 1, max: 100000 },
      description: "Referring this many NEW paid store subscriptions within a calendar month grants an Ambassador the configured monthly performance reward (FR-33.5).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.ambassador_certificate_tier_thresholds" },
    create: {
      key: "growth.ambassador_certificate_tier_thresholds",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: [
        { name: "Silver", threshold: 100 },
        { name: "Gold", threshold: 500 },
        { name: "Diamond", threshold: 1000 },
      ],
      description: "Ambassador certificate tiers, unlocked by lifetime referred-paid-sales count (FR-33.5) - names/thresholds/count are admin-editable data, never hard-coded.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.student_creator_commission_percent" },
    create: {
      key: "growth.student_creator_commission_percent",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 5,
      validation: { min: 0, max: 100 },
      description: "Student Referral and Creator programs' shared referral commission (%) of a referred seller's paid plan-subscription amount (FR-33.6/33.7).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.student_creator_commission_window_months" },
    create: {
      key: "growth.student_creator_commission_window_months",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 3,
      validation: { min: 1, max: 60 },
      description: "How many months of a referred seller's plan-subscription payments earn Student Referral/Creator commission (FR-33.6/33.7) - locked in per-attribution.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.creator_view_reward_per_million_pkr" },
    create: {
      key: "growth.creator_view_reward_per_million_pkr",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 0,
      validation: { min: 0, max: 10000000 },
      description: "PKR reward per million verified views for Creator content (FR-33.7) - zero disables view-based rewards until the founder sets a real rate.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.creator_monthly_reward_cap_pkr" },
    create: {
      key: "growth.creator_monthly_reward_cap_pkr",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 0,
      validation: { min: 0, max: 100000000 },
      description: "Maximum PKR a single Creator can earn from view-based rewards in one calendar month (FR-33.7), regardless of reported/verified views. Zero means no reward can ever be paid until set.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.withdrawal_minimum_pkr" },
    create: {
      key: "growth.withdrawal_minimum_pkr",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 1000,
      validation: { min: 0, max: 10000000 },
      description: "Minimum wallet balance (PKR) a program participant must hold before a withdrawal request is accepted (FR-33.9).",
    },
    update: {},
  });
}
