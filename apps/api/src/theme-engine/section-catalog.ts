/**
 * D-Studio v1 (SRS forward-reference only, section+animation library
 * designed and specified in this module) - the server-side source of
 * truth for what a seller's plan tier can actually build. Mirrored on the
 * frontend (apps/web/lib/section-catalog.ts) since there is no shared
 * package between apps/api and apps/web in this repo (same duplication
 * precedent as SectionId/ThemeSettings themselves) - keep both in sync by
 * hand; theme-engine.e2e-spec.ts's tier-gating tests are the tripwire if
 * they drift.
 *
 * Tier floors are plain data here, not Settings Registry keys - unlike
 * theme.premium_tier_enabled/theme.coded_mode_enabled (single booleans),
 * a per-section-and-per-preset floor is a 36-entry map that doesn't fit
 * SettingsService.resolve()'s one-key-one-value shape without inventing a
 * new pattern. tierOrder comparison is already a direct, established
 * precedent elsewhere (FinanceTerminalService.commissionStatusByTier()).
 *
 * Founder-approved tier reallocation (this session): GO ships a complete,
 * professional 8-section store with one animation preset (never "GO
 * feels crippled"); RUN's upgrade case is richer motion + a modestly
 * wider section set; RISE unlocks the full library + Custom CSS. FLY
 * shares RISE's ceiling exactly (no feature withheld to upsell FLY) -
 * see FLY_EXCLUSIVE_VARIANTS below for its early-access variants instead.
 */
export type SectionId =
  | "hero"
  | "featured_products"
  | "about"
  | "testimonials"
  | "faq"
  | "footer_contact"
  | "newsletter"
  | "spacer"
  | "featured_collection"
  | "gallery"
  | "video_banner"
  | "countdown"
  | "stats_counter"
  | "logo_cloud"
  | "team"
  | "before_after"
  | "map_location"
  | "social_feed"
  | "sticky_cta"
  | "shape_divider"
  | "comparison_table"
  | "blog_highlight";

export type AnimationId =
  | "none"
  | "fade-up"
  | "fade-in"
  | "slide-in"
  | "scale-in"
  | "stagger-reveal"
  | "hover-lift"
  | "ken-burns"
  | "text-split"
  | "parallax"
  | "magnetic"
  | "glass-reveal"
  | "gradient-shift"
  | "sticky-pin"
  | "lottie";

export type ElementSlot = "heading" | "text" | "button" | "image";

export interface SectionCatalogEntry {
  category: "Marketing" | "Catalog" | "Content" | "Social proof" | "Structural";
  variantCount: number;
  /** 0=GO, 1=RUN, 2=RISE (FLY shares RISE's floor everywhere - see FLY_EXCLUSIVE_VARIANTS). */
  tierFloor: number;
  /** GO/RUN may only use variant index 0..maxVariantIndexByTier[tierOrder]; RISE+ gets every variant. */
  maxVariantIndexByTier: [number, number];
  flyExclusiveVariant?: string;
}

export interface AnimationCatalogEntry {
  category: string;
  tierFloor: number;
}

export const SECTION_CATALOG: Record<SectionId, SectionCatalogEntry> = {
  // GO (8) - a complete, professional store, single layout, founder directive.
  hero: { category: "Marketing", variantCount: 4, tierFloor: 0, maxVariantIndexByTier: [0, 1], flyExclusiveVariant: "Diagonal split" },
  featured_products: { category: "Catalog", variantCount: 3, tierFloor: 0, maxVariantIndexByTier: [0, 1], flyExclusiveVariant: "Editorial grid" },
  about: { category: "Content", variantCount: 3, tierFloor: 0, maxVariantIndexByTier: [0, 1] },
  testimonials: { category: "Social proof", variantCount: 3, tierFloor: 0, maxVariantIndexByTier: [0, 1] },
  faq: { category: "Content", variantCount: 2, tierFloor: 0, maxVariantIndexByTier: [0, 1] },
  footer_contact: { category: "Content", variantCount: 1, tierFloor: 0, maxVariantIndexByTier: [0, 0] },
  newsletter: { category: "Marketing", variantCount: 3, tierFloor: 0, maxVariantIndexByTier: [0, 1] },
  spacer: { category: "Structural", variantCount: 3, tierFloor: 0, maxVariantIndexByTier: [0, 2] },
  // RUN (+6, running total 14) - modestly wider; RUN's real value is motion.
  featured_collection: { category: "Catalog", variantCount: 2, tierFloor: 1, maxVariantIndexByTier: [0, 1] },
  gallery: { category: "Content", variantCount: 3, tierFloor: 1, maxVariantIndexByTier: [0, 1] },
  video_banner: { category: "Marketing", variantCount: 2, tierFloor: 1, maxVariantIndexByTier: [0, 1] },
  countdown: { category: "Marketing", variantCount: 2, tierFloor: 1, maxVariantIndexByTier: [0, 1] },
  stats_counter: { category: "Social proof", variantCount: 2, tierFloor: 1, maxVariantIndexByTier: [0, 1] },
  logo_cloud: { category: "Social proof", variantCount: 2, tierFloor: 1, maxVariantIndexByTier: [0, 1] },
  // RISE (+8, running total 22) - full creative range.
  team: { category: "Content", variantCount: 2, tierFloor: 2, maxVariantIndexByTier: [0, 1] },
  before_after: { category: "Social proof", variantCount: 2, tierFloor: 2, maxVariantIndexByTier: [0, 1] },
  map_location: { category: "Content", variantCount: 2, tierFloor: 2, maxVariantIndexByTier: [0, 1] },
  social_feed: { category: "Social proof", variantCount: 1, tierFloor: 2, maxVariantIndexByTier: [0, 0] },
  sticky_cta: { category: "Marketing", variantCount: 2, tierFloor: 2, maxVariantIndexByTier: [0, 1] },
  shape_divider: { category: "Structural", variantCount: 3, tierFloor: 2, maxVariantIndexByTier: [0, 1] },
  comparison_table: { category: "Catalog", variantCount: 2, tierFloor: 2, maxVariantIndexByTier: [0, 1] },
  blog_highlight: { category: "Content", variantCount: 2, tierFloor: 2, maxVariantIndexByTier: [0, 1] },
};

export const ALL_SECTION_IDS = Object.keys(SECTION_CATALOG) as SectionId[];

export const ANIMATION_CATALOG: Record<AnimationId, AnimationCatalogEntry> = {
  none: { category: "—", tierFloor: 0 },
  "fade-up": { category: "Entrance", tierFloor: 0 },
  "fade-in": { category: "Entrance", tierFloor: 1 },
  "slide-in": { category: "Entrance", tierFloor: 1 },
  "scale-in": { category: "Entrance", tierFloor: 1 },
  "stagger-reveal": { category: "Entrance · list", tierFloor: 1 },
  "hover-lift": { category: "Micro-interaction", tierFloor: 1 },
  "ken-burns": { category: "Image", tierFloor: 2 },
  "text-split": { category: "Text", tierFloor: 2 },
  parallax: { category: "Scroll", tierFloor: 2 },
  magnetic: { category: "Micro-interaction", tierFloor: 2 },
  "glass-reveal": { category: "Glass", tierFloor: 2 },
  "gradient-shift": { category: "Background", tierFloor: 2 },
  "sticky-pin": { category: "Section transition", tierFloor: 2 },
  lottie: { category: "Illustration", tierFloor: 2 },
};

export const ALL_ANIMATION_IDS = Object.keys(ANIMATION_CATALOG) as AnimationId[];

export const ELEMENT_SLOTS: ElementSlot[] = ["heading", "text", "button", "image"];
