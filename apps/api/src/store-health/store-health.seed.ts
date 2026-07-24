import { PrismaClient } from "@prisma/client";

/**
 * Module 23 (SRS §5.34, FR-34.1-34.2) - every tunable constant behind the
 * Store Health Score, expressed as Settings Registry values so a weight or
 * threshold changes the NEXT computed score without a deploy.
 *
 * The seven `storehealth.weight_*` keys are read as relative weights, not a
 * strict "must sum to 100" contract - StoreHealthScoreService normalizes by
 * their actual sum at compute time (see its own comment), so an admin
 * tweaking one weight without rebalancing the others can never silently
 * break the 0-100 bound.
 */
export async function seedStoreHealthSettings(prisma: PrismaClient) {
  const weight = async (key: string, defaultValue: number, description: string) => {
    await prisma.settingsDefinition.upsert({
      where: { key },
      create: { key, valueType: "number", allowedScopes: ["global"], defaultValue, validation: { min: 0, max: 100 }, description },
      update: {},
    });
  };

  await weight("storehealth.weight_fulfillment", 20, "Store Health Score weight: on-time fulfillment rate (FR-34.1).");
  await weight("storehealth.weight_cancellation", 15, "Store Health Score weight: cancellation rate (FR-34.1).");
  await weight("storehealth.weight_pending_forever", 10, "Store Health Score weight: pending-forever rate (FR-34.1).");
  await weight("storehealth.weight_disputes", 15, "Store Health Score weight: dispute/refund signals (FR-34.1).");
  await weight("storehealth.weight_profile_completeness", 15, "Store Health Score weight: profile completeness (FR-34.1).");
  await weight("storehealth.weight_account_age", 10, "Store Health Score weight: account age, deliberately capped (FR-34.1).");
  await weight("storehealth.weight_moderation_risk", 15, "Store Health Score weight: moderation/risk history (FR-34.1).");

  await prisma.settingsDefinition.upsert({
    where: { key: "storehealth.fulfillment_target_days" },
    create: {
      key: "storehealth.fulfillment_target_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 3,
      validation: { min: 1, max: 60 },
      description: "Days from an order's 'confirmed' event to its 'shipped' event that counts as on-time (FR-34.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "storehealth.trailing_window_days" },
    create: {
      key: "storehealth.trailing_window_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 90,
      validation: { min: 7, max: 730 },
      description: "Trailing window (days) the order-based Store Health Score inputs are measured over (FR-34.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "storehealth.stale_pending_days" },
    create: {
      key: "storehealth.stale_pending_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 5,
      validation: { min: 1, max: 90 },
      description: "Days an order may sit at `pending` before it counts toward the pending-forever rate (FR-34.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "storehealth.account_age_reference_months" },
    create: {
      key: "storehealth.account_age_reference_months",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 240 },
      description: "Seller account age (months) at which the account-age input reaches its full score (FR-34.1) - older never scores higher than this.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "storehealth.recompute_interval_hours" },
    create: {
      key: "storehealth.recompute_interval_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 168 },
      description: "How often the Store Health Score recompute sweep runs (FR-34.2).",
    },
    update: {},
  });
}
