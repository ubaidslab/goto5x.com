import { PrismaClient } from "@prisma/client";

/**
 * Module 16's one settings key (SRS §5.25/FR-25.5). Pakistan-only at launch,
 * per SRS's own "creation is Pakistan-only at launch" framing - opening a new
 * region is a Settings Registry write, never a deploy.
 */
export async function seedOnboardingSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "auth.seller_signup_allowed_countries" },
    create: {
      key: "auth.seller_signup_allowed_countries",
      valueType: "json",
      allowedScopes: ["global"],
      defaultValue: ["PK"],
      description:
        "ISO-3166 alpha-2 country codes a seller may sign up from; a blocked attempt is waitlisted instead of rejected (FR-25.5).",
    },
    update: {},
  });
}
