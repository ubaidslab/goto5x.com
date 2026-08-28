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
}
