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

/**
 * Module 3's real settings keys - the CNAME/A-record targets a seller points
 * their DNS at, the platform's own root domain (rejects a custom-domain
 * attach attempt that's actually one of the platform's own free
 * subdomains), and the scheduled recheck job's poll interval (SRS FR-11.2).
 */
export async function seedModule3Settings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "domains.cname_target" },
    create: {
      key: "domains.cname_target",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "stores.goto5x.com",
      description: "CNAME value sellers point their custom domain at.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "domains.a_record_ip" },
    create: {
      key: "domains.a_record_ip",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "127.0.0.1",
      description: "VPS public IP for apex/root domains, which can't use a CNAME per DNS rules.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "domains.platform_root_domain" },
    create: {
      key: "domains.platform_root_domain",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "goto5x.com",
      description: "Rejects attaching a domain that is actually one of the platform's own free subdomains.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "domains.verification_poll_minutes" },
    create: {
      key: "domains.verification_poll_minutes",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 10,
      validation: { min: 1, max: 1440 },
      description: "How often the scheduled worker job rechecks pending/failed domains (SRS FR-11.2).",
    },
    update: {},
  });
}

/**
 * v0.8 amendment's one settings key - the Platform Event Log's
 * retention/archival threshold (SRS §3.11). No archival job reads it yet;
 * it exists so adding one later is a worker job, not a schema change.
 */
export async function seedPlatformEventsSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "platform_events.retention_days" },
    create: {
      key: "platform_events.retention_days",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 730,
      validation: { min: 30, max: 3650 },
      description: "How long platform_events rows are kept before a future archival job may remove them.",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  Promise.resolve()
    .then(() => seedModule1Settings(prisma))
    .then(() => seedModule3Settings(prisma))
    .then(() => seedPlatformEventsSettings(prisma))
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
