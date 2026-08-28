import { PrismaClient } from "@prisma/client";

/** Financial-safety hardening - same pattern as billing/wallet.seed.ts's reconciliation-interval key. */
export async function seedPlatformGatewaySettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "billing.platform_gateway_reconciliation_interval_hours" },
    create: {
      key: "billing.platform_gateway_reconciliation_interval_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 168,
      validation: { min: 1, max: 720 },
      description:
        "How often the Platform Merchant Connection reconciliation sweep runs (default 168 = weekly) - re-polls recently auto-verified gateway references to confirm they're still confirmed, flagging any that no longer are for admin review.",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "billing.platform_gateway_submission_cooldown_seconds" },
    create: {
      key: "billing.platform_gateway_submission_cooldown_seconds",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 1, max: 3600 },
      description:
        "Retry-storm guard: minimum seconds a seller must wait between payment-reference submissions of the same kind (plan-fee payment, or a given template purchase) before another is allowed to attempt outbound gateway verification. Enforced atomically via Redis, closing the race the pre-existing 'already have a pending request' check alone can't (concurrent submissions could otherwise both pass that check before either commits).",
      requiresConfirmation: true,
    },
    update: { requiresConfirmation: true },
  });
}
