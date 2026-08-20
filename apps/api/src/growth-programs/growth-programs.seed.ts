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

  // Module 78 (SRS §5.33, FR-33.5) repriced Student Referral off this
  // shared key onto its own flat-rate model below - this key is now
  // Creator-only, kept under its original name (a live Settings key
  // rename is riskier than a description correction; the key's own
  // per-programType resolution in ProgramCommissionService now only ever
  // reaches this branch for "creator").
  await prisma.settingsDefinition.upsert({
    where: { key: "growth.student_creator_commission_percent" },
    create: {
      key: "growth.student_creator_commission_percent",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 5,
      validation: { min: 0, max: 100 },
      description: "Creator program's referral commission (%) of a referred seller's paid plan-subscription amount (FR-33.7). Student Referral moved to its own flat-rate model in Module 78 (FR-33.5) - this key no longer applies to it.",
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
      description: "How many months of a referred seller's plan-subscription payments earn Creator commission (FR-33.7) - locked in per-attribution. Student Referral moved to its own renewal-count cap in Module 78 (FR-33.5) - this key no longer applies to it.",
    },
    update: {},
  });

  // Module 78 (SRS §5.33, FR-33.5) - Student Referral renamed "Commerce
  // Students Support" and repriced off the shared percent/window model
  // above onto a flat PKR amount per RENEWAL (never the referred seller's
  // first/initial plan-fee payment), capped by count rather than time -
  // see ReferralAttribution.renewalPayoutCount and
  // ProgramCommissionService's dedicated student_referral branch.
  await prisma.settingsDefinition.upsert({
    where: { key: "growth.student_referral_program_name" },
    create: {
      key: "growth.student_referral_program_name",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "Commerce Students Support",
      description: "Display name for the student_referral program (FR-33.5) - admin-editable, never hard-coded in product copy.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.student_referral_flat_commission_pkr" },
    create: {
      key: "growth.student_referral_flat_commission_pkr",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 345,
      validation: { min: 0, max: 1000000 },
      description: "Flat PKR commission paid to a Student Referral participant per qualifying renewal of a referred seller's plan fee (FR-33.5).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.student_referral_max_renewal_payouts" },
    create: {
      key: "growth.student_referral_max_renewal_payouts",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 2,
      validation: { min: 0, max: 60 },
      description: "Maximum number of a referred seller's renewal payments that earn Student Referral commission (FR-33.5) - the referred seller's own FIRST/initial payment never counts.",
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
