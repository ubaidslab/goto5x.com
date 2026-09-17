import { PrismaClient } from "@prisma/client";
import { DESIGN_TOKENS } from "./design-tokens.constants";

/**
 * Module 92 (SRS §5.68/FR-68.1-68.2) - registers the 13 core brand color
 * tokens as Settings Registry definitions. Every one is global-scope-only,
 * `color`-typed, and seeded `requiresConfirmation: true` (FR-8.16) - a
 * platform-wide brand color change is exactly the high-impact category
 * that mechanism exists for.
 *
 * v1.3 monochrome-pass bug fix: `update: {}` used to mean re-running this
 * seed against an already-seeded DB never refreshed `defaultValue`/
 * `description` on the existing SettingsDefinition rows - and
 * SettingsService.resolve() falls back to THAT DB column, not to this
 * file's DESIGN_TOKENS constant, whenever no SettingsValue override
 * exists. Caught live while verifying this pass: an already-seeded DB
 * (i.e. any real deployed environment, since Module 92 already shipped)
 * kept resolving the OLD cream/green hex values as if they were active
 * admin overrides - DesignTokensController's public /design-tokens
 * endpoint would have silently kept injecting the old palette as a CSS
 * override on every page load even after this whole rebrand shipped,
 * because `resolved !== token.defaultValue` was comparing a stale DB
 * value against the new code constant and treating the mismatch as an
 * intentional override. Now syncs both columns on every seed run, so a
 * code-level rebrand's defaults actually take effect once re-seeded.
 */
export async function seedDesignTokensSettings(prisma: PrismaClient) {
  for (const token of DESIGN_TOKENS) {
    await prisma.settingsDefinition.upsert({
      where: { key: token.key },
      create: {
        key: token.key,
        valueType: "color",
        allowedScopes: ["global"],
        defaultValue: token.defaultValue,
        description: token.description,
        requiresConfirmation: true,
      },
      update: {
        defaultValue: token.defaultValue,
        description: token.description,
      },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDesignTokensSettings(prisma)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Design token settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
