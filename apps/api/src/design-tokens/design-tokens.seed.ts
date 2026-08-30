import { PrismaClient } from "@prisma/client";
import { DESIGN_TOKENS } from "./design-tokens.constants";

/**
 * Module 92 (SRS §5.68/FR-68.1-68.2) - registers the 13 core brand color
 * tokens as Settings Registry definitions. Every one is global-scope-only,
 * `color`-typed, and seeded `requiresConfirmation: true` (FR-8.16) - a
 * platform-wide brand color change is exactly the high-impact category
 * that mechanism exists for.
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
      update: {},
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
