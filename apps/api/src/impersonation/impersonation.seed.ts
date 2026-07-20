import { PrismaClient } from "@prisma/client";

/** Module 17 (FR-8.4) - impersonation's one settings key: how long a "login as seller" session stays valid before it must be started again (reason required each time). */
export async function seedImpersonationSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "admin.impersonation_session_ttl_minutes" },
    create: {
      key: "admin.impersonation_session_ttl_minutes",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 30,
      validation: { min: 5, max: 240 },
      description: "How long a 'login as seller' impersonation session stays valid before it expires (FR-8.4).",
    },
    update: {},
  });
}
