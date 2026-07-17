import { PrismaClient } from "@prisma/client";

/**
 * Module 6's Settings Registry keys (SRS §5.27/FR-27.1-27.3). All
 * admin-editable through the already-generic Settings Registry admin API -
 * no new admin UI mechanism needed, no new tables for the keyword/category
 * lists themselves.
 */
export async function seedModerationSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "moderation.banned_keywords" },
    create: {
      key: "moderation.banned_keywords",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: [],
      description: "A listing containing any of these terms (title/description) is rejected outright (FR-27.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "moderation.restricted_keywords" },
    create: {
      key: "moderation.restricted_keywords",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: [],
      description: "A listing containing any of these terms enters the moderation queue instead of being blocked (FR-27.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "moderation.restricted_categories" },
    create: {
      key: "moderation.restricted_categories",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: [],
      description: "A listing in one of these category ids always enters the moderation queue (FR-27.2).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "moderation.new_seller_probation_count" },
    create: {
      key: "moderation.new_seller_probation_count",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 0, max: 1000 },
      description: "A non-trusted seller's first N products are manually reviewed regardless of keyword/category checks (FR-27.3).",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedModerationSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Moderation settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
