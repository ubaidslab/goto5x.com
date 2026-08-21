import { PrismaClient } from "@prisma/client";

/**
 * SRS §5.6k (v0.41) - Settings Registry keys for the Subscription Business
 * Readiness re-amendment (Modules 63-72, 89, 90). Must run after
 * seedPlansData() - support.sla_hours' per-plan seeding below queries the
 * paid plan rows.
 */
export async function seedSubscriptionReadinessSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.data_retention_days" },
    create: {
      key: "billing.data_retention_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 14,
      validation: { min: 1, max: 90 },
      description: "Days after a store is paused for plan-fee non-payment before its data is permanently deleted (FR-6.41).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.gateway_health_alert_threshold_percent" },
    create: {
      key: "billing.gateway_health_alert_threshold_percent",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 90,
      validation: { min: 0, max: 100 },
      description: "A payment gateway provider's rolling success rate below this triggers a seller email + dashboard banner to every connected store (FR-6.44).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "growth.funnel_stuck_days" },
    create: {
      key: "growth.funnel_stuck_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 14,
      validation: { min: 1, max: 90 },
      description: "Days at a seller-health-funnel stage with no progress before a seller is listed as 'stuck' for founder intervention (FR-6.46).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.subscription_refund_window_days" },
    create: {
      key: "billing.subscription_refund_window_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 7,
      validation: { min: 1, max: 90 },
      description: "Days after a first-cycle subscription payment during which a qualifying cancellation is eligible for the partial refund policy (FR-6.49).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.subscription_refund_percent" },
    create: {
      key: "billing.subscription_refund_percent",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 50,
      validation: { min: 0, max: 100 },
      description: "Percentage of the first cycle's actually-paid price refunded to the seller's wallet on a qualifying cancellation (FR-6.49).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "support.sla_hours" },
    create: {
      key: "support.sla_hours",
      valueType: "number",
      allowedScopes: ["global", "plan"],
      defaultValue: 48,
      validation: { min: 1, max: 168 },
      description: "Support-ticket response-time commitment in hours, per plan tier (FR-6.45): GO 48 / RUN 24 / RISE 12 / FLY 4.",
    },
    update: {},
  });

  const slaHoursByTierOrder: Record<number, number> = { 0: 48, 1: 24, 2: 12, 3: 4 };
  const individualPlans = await prisma.plan.findMany({ where: { planGroup: "individual" } });
  for (const plan of individualPlans) {
    const value = slaHoursByTierOrder[plan.tierOrder];
    if (value == null) continue;
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "support.sla_hours", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "support.sla_hours", scopeType: "plan", scopeId: plan.id, value },
      update: { value },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedSubscriptionReadinessSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Subscription business readiness settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
