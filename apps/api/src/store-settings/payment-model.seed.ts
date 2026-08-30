import { PrismaClient } from "@prisma/client";

/** Module 95's Settings Registry keys (SRS §5.6l, FR-6.61-6.68). */
export async function seedPaymentModelSettings(prisma: PrismaClient) {
  // FR-6.62 - "Prepaid" is the only tier-gated choice in the store-wide
  // payment-model picker; "cod" and "advance" are available on every tier.
  // Value set per-plan inside plans.seed.ts's per-tier loop, same
  // "definition here, value set where the tier/plan.id pairing already
  // exists" idiom as orders.prepaid_partial_advance_enabled.
  await prisma.settingsDefinition.upsert({
    where: { key: "payments.prepaid_model_enabled" },
    create: {
      key: "payments.prepaid_model_enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan", "seller"],
      defaultValue: false,
      description: "Whether a seller's plan includes the Prepaid store-wide payment model (FR-6.62). Off by default; on for RUN+.",
    },
    update: {},
  });

  // FR-6.63 - deliberately a separate key from
  // orders.prepaid_partial_advance_percent (Module 76's anti-fraud
  // verification-channel percent) - the two "advance" concepts stay
  // architecturally distinct even though both reuse
  // PaymentGatewayService.chargeViaGateway() as their charge engine.
  await prisma.settingsDefinition.upsert({
    where: { key: "payments.advance_model_percent" },
    create: {
      key: "payments.advance_model_percent",
      valueType: "number",
      allowedScopes: ["global", "store"],
      defaultValue: 20,
      validation: { min: 10, max: 50 },
      description:
        "Percentage of the order total a buyer pays via the seller's connected gateway at checkout under the Advance payment model (FR-6.63); the remainder is collected COD. Separate from orders.prepaid_partial_advance_percent (a different, anti-fraud-only mechanism).",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedPaymentModelSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Payment model settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
