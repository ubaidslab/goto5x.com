import { PrismaClient } from "@prisma/client";

/**
 * Module 18 (SRS §6.5 rate limiting; FR-24.5's plan-tier gate). Rate limits
 * are Settings Registry values, never hard-coded constants, same discipline
 * as every other RateLimitService caller. `theme.premium_tier_enabled`
 * closes the loose end schema.prisma's `Theme` model doc comment flagged
 * since Module 4 ("no gating enforced yet - that's Module 11/14's job") -
 * defaulting to `false` preserves the exact "off for every seller in v1.0"
 * behavior already in production, so this is non-breaking.
 */
export async function seedExternalApiSettings(prisma: PrismaClient) {
  await prisma.settingsDefinition.upsert({
    where: { key: "external_api.template_install_rate_limit_per_hour" },
    create: {
      key: "external_api.template_install_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 60,
      description: "Max Template Install/License API calls per hour, keyed per calling client (FR-24.6, §6.5).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "external_api.product_feed_rate_limit_per_hour" },
    create: {
      key: "external_api.product_feed_rate_limit_per_hour",
      valueType: "number",
      allowedScopes: ["global"],
      defaultValue: 120,
      description: "Max Product Feed API calls per hour, keyed per seller API token (FR-24.11, §6.5).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "template_store.showcase_url" },
    create: {
      key: "template_store.showcase_url",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "",
      description:
        "The Template Store's premium-templates showcase link-out (FR-24.2). Empty in v1.0 (the Template Store doesn't exist yet) - the theme-selection UI's showcase panel is hidden, never a broken link, proving the built-in theme catalog has no hard dependency on it (FR-24.1).",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "social_media_saas.marketing_handoff_base_url" },
    create: {
      key: "social_media_saas.marketing_handoff_base_url",
      valueType: "string",
      allowedScopes: ["global"],
      defaultValue: "",
      description:
        "The Social Media SaaS's SSO landing URL (FR-24.8). Empty in v1.0 (that product doesn't exist yet) - the dashboard's Marketing section shows a documented 'not configured yet' state rather than a broken handoff.",
    },
    update: {},
  });

  await prisma.settingsDefinition.upsert({
    where: { key: "theme.premium_tier_enabled" },
    create: {
      key: "theme.premium_tier_enabled",
      valueType: "boolean",
      allowedScopes: ["global", "plan"],
      defaultValue: false,
      description:
        "Whether a seller may select a premium-tier theme (distinct from a marketplace-tier theme, which is gated purely by TemplateEntitlement, FR-24.5). Off for every seller in v1.0, same precedent as theme.coded_mode_enabled.",
    },
    update: {},
  });
}
