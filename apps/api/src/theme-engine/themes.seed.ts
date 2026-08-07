import { PrismaClient } from "@prisma/client";

/**
 * The built-in template catalog (SRS FR-1.1). Four genuinely distinct,
 * hand-designed visual templates (Editorial/Studio/Market/Atelier - see
 * docs/architecture.md's Template Package Spec), plus a "Start from blank"
 * utility option that reuses the same bounded customizer at its emptiest
 * starting state rather than being a different system. Bare-functional
 * visual design for this pass (per the design-phase founder direction) -
 * the later Figma-involved polish pass replaces these designs in place,
 * never their ids/section-id contract.
 *
 * `sortOrder` is the deliberate, non-alphabetical default-assignment and
 * picker-listing order (StoresService.create(), ThemesService.
 * listSelectable()) - "Start from blank" sorts last so it's never the
 * accidental auto-assigned default for a brand-new store.
 */
export async function seedBuiltInThemes(prisma: PrismaClient) {
  // Fixed, valid v4-format UUIDs (version nibble 4, variant nibble 8) so
  // this is idempotent/safe to re-run - NOT all-zero placeholders, which
  // fail @IsUUID() validation on the customizer's PATCH endpoint (the
  // version/variant nibbles must be present for a UUID to validate as v4,
  // caught by an e2e test round-tripping a real seeded theme id through
  // that endpoint, not assumed to be a valid UUID just because it's
  // hex-shaped). The first 3 ids are reused from the original Classic/
  // Modern/Minimal placeholders (renamed/redesigned in place); Atelier and
  // Start-from-blank are new rows.
  await prisma.theme.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Editorial",
      tier: "free",
      version: "1.0.0",
      isActive: true,
      sortOrder: 0,
    },
    update: { name: "Editorial", tier: "free", sortOrder: 0 },
  });

  await prisma.theme.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Studio",
      tier: "premium",
      version: "1.0.0",
      isActive: true,
      sortOrder: 2,
    },
    update: { name: "Studio", tier: "premium", sortOrder: 2 },
  });

  await prisma.theme.upsert({
    where: { id: "33333333-3333-4333-8333-333333333333" },
    create: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Market",
      tier: "premium",
      version: "1.0.0",
      isActive: true,
      sortOrder: 3,
    },
    update: { name: "Market", tier: "premium", sortOrder: 3 },
  });

  await prisma.theme.upsert({
    where: { id: "44444444-4444-4444-8444-444444444444" },
    create: {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Atelier",
      tier: "free",
      version: "1.0.0",
      isActive: true,
      sortOrder: 1,
    },
    update: { name: "Atelier", tier: "free", sortOrder: 1 },
  });

  await prisma.theme.upsert({
    where: { id: "55555555-5555-4555-8555-555555555555" },
    create: {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Start from blank",
      tier: "free",
      version: "1.0.0",
      isActive: true,
      sortOrder: 99,
    },
    update: { name: "Start from blank", tier: "free", sortOrder: 99 },
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

  await prisma.settingsDefinition.upsert({
    where: { key: "storefront.unlock_rate_limit_per_hour" },
    create: {
      key: "storefront.unlock_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 20,
      validation: { min: 1, max: 1000 },
      description:
        "Maximum POST /storefront/unlock attempts per IP and per store per hour (Phase B pre-launch audit finding - the password-gate check has no attempt cap beyond the generic 100/min IP throttle, FR-16.5).",
    },
    update: {},
  });
}

/**
 * Templates module (v0.31 design phase, storefront branding FR) - the
 * "Managed by UZEYN" storefront mark. Two keys, deliberately separate
 * (mirrors the plan-capability + store-preference split already used for
 * theme.premium_tier_enabled's gate vs. an individual store's own choice):
 *
 *  - `branding.powered_by_removable` (plan-scoped capability): whether the
 *    seller's CURRENT plan permits hiding the mark at all. Global default
 *    `false` - any plan with no override can never hide it. v0.33/SRS
 *    "Plans & Pricing": First Month and Starter both carry the mark forced
 *    (founder-mandated "our free organic marketing" invariant); only Pro
 *    (individual tierOrder 3) makes it removable - Growth does not. Every
 *    paid team tier keeps the pre-v0.33 behavior (unaffected by the
 *    individual-tier pricing rework), so it's still seeded `true` below.
 *  - `branding.powered_by_hidden` (store-scoped preference): the seller's
 *    own choice, once their plan permits it. Storing this separately from
 *    the capability means a seller who sets it, then downgrades to Free,
 *    reverts to the mark showing automatically - BrandingService.
 *    getVisibility() ANDs both, never trusting the stored preference alone.
 */
export async function seedTemplatesBrandingSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "branding.powered_by_removable" },
    create: {
      key: "branding.powered_by_removable",
      valueType: "boolean",
      allowedScopes: ["global", "plan"],
      defaultValue: false,
      description:
        "Whether the seller's plan permits hiding the 'Managed by UZEYN' storefront mark. Off on Free (mandatory there by founder mandate); on for paid individual/team tiers.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "branding.powered_by_hidden" },
    create: {
      key: "branding.powered_by_hidden",
      valueType: "boolean",
      allowedScopes: ["global", "store"],
      defaultValue: false,
      description: "A store's own preference to hide the 'Managed by UZEYN' mark - only takes effect if the seller's plan permits it.",
    },
    update: {},
  });

  // v0.33 - only individual Pro (tierOrder 3) gets the capability among
  // individual tiers now (First Month/Starter/Growth all keep the mark
  // forced); every paid team tier keeps the pre-v0.33 "any paid tier"
  // behavior, unaffected by the individual pricing rework. Must run after
  // seedPlansData() so these rows exist.
  const eligiblePlans = await prisma.plan.findMany({
    where: {
      OR: [
        { planGroup: "individual", tierOrder: 3 },
        { planGroup: "team", tierOrder: { gt: 0 } },
      ],
    },
  });
  for (const plan of eligiblePlans) {
    await prisma.settingsValue.upsert({
      where: { uniq_settings_scope: { definitionKey: "branding.powered_by_removable", scopeType: "plan", scopeId: plan.id } },
      create: { definitionKey: "branding.powered_by_removable", scopeType: "plan", scopeId: plan.id, value: true },
      update: { value: true },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  Promise.resolve()
    .then(() => seedBuiltInThemes(prisma))
    .then(() => seedModule4Settings(prisma))
    .then(() => seedTemplatesBrandingSettings(prisma))
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
