import { PrismaClient } from "@prisma/client";

/** Module 9's Settings Registry keys (FR-15.2). */
export async function seedOrdersSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "cart.abandoned_after_hours" },
    create: {
      key: "cart.abandoned_after_hours",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 24,
      validation: { min: 1, max: 720 },
      description: "A cart with no activity for this many hours is flagged `abandoned` (FR-15.2).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "cart.abandonment_sweep_minutes" },
    create: {
      key: "cart.abandonment_sweep_minutes",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 60,
      validation: { min: 5, max: 1440 },
      description: "How often the scheduled worker job sweeps for newly-abandoned carts (FR-15.2).",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedOrdersSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Orders settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
