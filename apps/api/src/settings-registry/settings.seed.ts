import { PrismaClient } from "@prisma/client";

/**
 * Registers Module 1's real settings keys - proving the registry drives
 * actual behavior (signup rate limiting, password-reset TTL/rate limiting)
 * rather than shipping as an empty mechanism. Run via `ts-node
 * src/settings-registry/settings.seed.ts` against a fresh database, or
 * imported by e2e test setup.
 */
export async function seedModule1Settings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "auth.signup_rate_limit_per_hour" },
    create: {
      key: "auth.signup_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 1, max: 1000 },
      description: "Maximum signup attempts per IP per hour.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "auth.password_reset_token_ttl_minutes" },
    create: {
      key: "auth.password_reset_token_ttl_minutes",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 45,
      validation: { min: 5, max: 1440 },
      description: "How long a password reset link stays valid (SRS FR-25.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "auth.password_reset_rate_limit_per_hour" },
    create: {
      key: "auth.password_reset_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 5,
      validation: { min: 1, max: 100 },
      description: "Maximum password reset requests per account/IP per hour (SRS FR-25.2).",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedModule1Settings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Module 1 settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
