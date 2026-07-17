import { PrismaClient } from "@prisma/client";

/**
 * Module 4's built-in theme catalog (SRS FR-1.1) - three structurally
 * distinct templates (different default section ordering/color scheme),
 * not three fully bespoke hand-designed visual templates. True premium-bar
 * visual design work is gated on branding assets not yet delivered (SRS §13
 * open question 3; docs/build-plan.md's "Known sequencing risk" on Module
 * 16/Module 4's founder visual sign-off) - disclosed transparently in this
 * module's verification report, not silently substituted.
 *
 * `tier` is descriptive only in v1.0 - see the `Theme` model's doc comment
 * in schema.prisma for why no plan-gating is enforced yet.
 */
export async function seedBuiltInThemes(prisma: PrismaClient) {
  // Fixed, valid v4-format UUIDs (version nibble 4, variant nibble 8) so
  // this is idempotent/safe to re-run - NOT all-zero placeholders, which
  // fail @IsUUID() validation on the customizer's PATCH endpoint (the
  // version/variant nibbles must be present for a UUID to validate as v4,
  // caught by an e2e test round-tripping a real seeded theme id through
  // that endpoint, not assumed to be a valid UUID just because it's
  // hex-shaped).
  await prisma.theme.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Classic",
      tier: "free",
      version: "1.0.0",
      isActive: true,
    },
    update: {},
  });

  await prisma.theme.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Modern",
      tier: "premium",
      version: "1.0.0",
      isActive: true,
    },
    update: {},
  });

  await prisma.theme.upsert({
    where: { id: "33333333-3333-4333-8333-333333333333" },
    create: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Minimal",
      tier: "premium",
      version: "1.0.0",
      isActive: true,
    },
    update: {},
  });
}

/**
 * The coded-theme escape hatch (FR-1.6, Phase 2) is gated by plan at the app
 * layer via this key. `plan` is an allowed scope so this resolves correctly
 * once Module 11 gives sellers a real plan assignment - until then every
 * seller falls through to the `global` default (`false`), which is exactly
 * the "off for every seller in v1.0" behavior SRS §14.1 requires.
 */
export async function seedModule4Settings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "theme.coded_mode_enabled" },
    create: {
      key: "theme.coded_mode_enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan"],
      defaultValue: false,
      description: "Whether a seller may set store_theme_settings.custom_code (FR-1.6, Phase 2 escape hatch).",
    },
    update: {},
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  Promise.resolve()
    .then(() => seedBuiltInThemes(prisma))
    .then(() => seedModule4Settings(prisma))
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Themes + Module 4 settings seeded.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
