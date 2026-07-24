import { PrismaClient } from "@prisma/client";

/** Module 23 (SRS §5.35, FR-35.1-35.6) - the Verified Store Program's Settings Registry-driven criteria/fee/policy values. */
export async function seedVerificationSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "verification.min_health_score" },
    create: {
      key: "verification.min_health_score",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 80,
      validation: { min: 0, max: 100 },
      description: "Minimum Store Health Score required to apply to the Verified Store Program (FR-35.1) - also the auto-flag-for-re-review threshold once verified (FR-35.5).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "verification.min_tenure_months" },
    create: {
      key: "verification.min_tenure_months",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 6,
      validation: { min: 0, max: 120 },
      description: "Minimum continuous months on the same verified custom domain required to apply (FR-35.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "verification.min_confirmed_sales" },
    create: {
      key: "verification.min_confirmed_sales",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 20,
      validation: { min: 0, max: 1000000 },
      description: "Minimum confirmed-or-later order count required to apply (FR-35.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "verification.fee_pkr" },
    create: {
      key: "verification.fee_pkr",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 5000,
      validation: { min: 0, max: 10000000 },
      description: "Verification application-processing fee (PKR), debited from the seller's wallet at application time - a processing fee, never a purchase of the badge (FR-35.2).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "verification.refund_on_reject" },
    create: {
      key: "verification.refund_on_reject",
      valueType: "boolean",
      allowedScopes: ["global"],
      defaultValue: true,
      description: "Whether an admin rejection fully refunds the verification fee (FR-35.3) - v1.0 default is true, expressed as data so it can change without a deploy.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "verification.annual_reverification_enabled" },
    create: {
      key: "verification.annual_reverification_enabled",
      valueType: "boolean",
      allowedScopes: ["global"],
      defaultValue: true,
      description: "Whether verified status expires after 12 months and requires a fresh application to renew (FR-35.6).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "verification.reverification_fee_pkr" },
    create: {
      key: "verification.reverification_fee_pkr",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 0,
      validation: { min: 0, max: 10000000 },
      description: "Fee (PKR) for an annual re-verification re-application - zero by default (no new fee), per FR-35.6.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "verification.rereview_sweep_interval_hours" },
    create: {
      key: "verification.rereview_sweep_interval_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description: "How often the sweep checks verified stores for health-score drift, T&S enforcement, and annual expiry (FR-35.5/35.6).",
    },
    update: {},
  });
}
