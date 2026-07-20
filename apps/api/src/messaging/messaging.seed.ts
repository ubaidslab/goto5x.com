import { PrismaClient } from "@prisma/client";

/**
 * Module 17's settings keys for FR-8.7's remaining piece (maintenance mode
 * + admin-IP allowlist) - the "scheduled platform-wide banner" half of
 * FR-8.7 is superseded by FR-8.15's PlatformMessage (channel=banner,
 * targetType=all), not a separate mechanism (SRS §5.8's own note).
 */
export async function seedMessagingSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "platform.maintenance_mode_enabled" },
    create: {
      key: "platform.maintenance_mode_enabled",
      valueType: "boolean",
      allowedScopes: ["global"],
      defaultValue: false,
      description: "Global kill-switch (FR-8.7): non-allowlisted requests see a maintenance page instead of the real app.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "platform.maintenance_admin_ip_allowlist" },
    create: {
      key: "platform.maintenance_admin_ip_allowlist",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: [],
      description: "IP addresses that still reach the app (incl. the admin terminal) while maintenance mode is enabled (FR-8.7).",
    },
    update: {},
  });
}
