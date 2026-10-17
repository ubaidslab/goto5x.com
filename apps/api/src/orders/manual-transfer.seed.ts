import { PrismaClient } from "@prisma/client";

/** B3b (founder decision, 2026-10-11) - Settings Registry keys for the "advance" payment model's Manual Transfer fallback. */
export async function seedManualTransferSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "orders.advance_manual_transfer_timeout_hours" },
    create: {
      key: "orders.advance_manual_transfer_timeout_hours",
      valueType: "number",
      allowedScopes: ["store", "global"],
      defaultValue: 48,
      validation: { min: 1, max: 336 },
      description:
        "An 'advance' payment-model order still pending (unconfirmed) this many hours after being placed is automatically cancelled and its stock restored - the backstop for a buyer who never transfers, or a seller who never checks.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "orders.manual_transfer_submission_rate_limit_per_hour" },
    create: {
      key: "orders.manual_transfer_submission_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 1, max: 1000 },
      description: "Maximum POST .../manual-transfer reference-submission calls per order-status token and per IP per hour - same abuse profile as returns.submission_rate_limit_per_hour.",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedManualTransferSettings(prisma)
    .then(() => {
      console.log("Manual transfer settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
