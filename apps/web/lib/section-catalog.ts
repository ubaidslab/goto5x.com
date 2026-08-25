/**
 * D-Studio v1 - frontend mirror of apps/api/src/theme-engine/
 * section-catalog.ts. No shared package exists between apps/web and
 * apps/api in this repo (same duplication precedent as ThemeSettings/
 * SectionId themselves) - keep both in sync by hand; the backend's
 * theme-engine.e2e-spec.ts tier-gating tests are the tripwire if they
 * drift (a section/preset this file exposes as unlocked but the server
 * rejects would surface as a 403 on save, not a silent bug).
 *
 * Founder-approved tier reallocation: GO ships a complete, professional
 * 8-section store with one animation preset (Fade Up) - GO must never
 * feel crippled. RUN's upgrade case is richer motion + a modestly wider
 * section set. RISE unlocks the full 22-section/14-preset library +
 * Custom CSS. FLY shares RISE's ceiling exactly (nothing withheld to
 * upsell FLY) - instead getting 30-day early access to new sections/
 * presets, plus a handful of FLY-exclusive premium layout variants on
 * high-value sections (flyExclusiveVariant below).
 */
import { AnimationId, ElementSlot, SectionId } from "./theme-presets";

export type SectionCategory = "Marketing" | "Catalog" | "Content" | "Social proof" | "Structural";

export interface SectionCatalogEntry {
  name: string;
  category: SectionCategory;
  variants: string[];
  tierFloor: number;
  maxVariantIndexByTier: [number, number];
  flyExclusiveVariant?: string;
  elements: ElementSlot[];
}

export const SECTION_CATALOG: Record<SectionId, SectionCatalogEntry> = {
  hero: {
    name: "Hero",
    category: "Marketing",
    variants: ["Centered", "Image left", "Image right", "Video background"],
    tierFloor: 0,
    maxVariantIndexByTier: [0, 1],
    flyExclusiveVariant: "Diagonal split",
    elements: ["heading", "text", "button", "image"],
  },
  featured_products: {
    name: "Product grid",
    category: "Catalog",
    variants: ["Grid · 3 col", "Grid · 4 col", "Carousel"],
    tierFloor: 0,
    maxVariantIndexByTier: [0, 1],
    flyExclusiveVariant: "Editorial grid",
    elements: ["heading", "image"],
  },
  about: {
    // Index 0 is "Text only" (not "Image left") deliberately - it's every
    // existing store's actual current rendering (no image in the About
    // section today), and `variant` defaults to 0 for any pre-D-Studio
    // saved settings row. Reordering this list would silently change the
    // layout of every already-published store with no code path involved.
    name: "Story / About",
    category: "Content",
    variants: ["Text only", "Image left", "Image right"],
    tierFloor: 0,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "text", "image"],
  },
  testimonials: {
    name: "Testimonials",
    category: "Social proof",
    variants: ["Carousel", "Grid", "Single quote"],
    tierFloor: 0,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "text"],
  },
  faq: {
    name: "FAQ",
    category: "Content",
    variants: ["Accordion", "Two column"],
    tierFloor: 0,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading"],
  },
  footer_contact: {
    name: "Footer / Contact",
    category: "Content",
    variants: ["Standard"],
    tierFloor: 0,
    maxVariantIndexByTier: [0, 0],
    elements: ["heading", "text"],
  },
  newsletter: {
    name: "Newsletter signup",
    category: "Marketing",
    variants: ["Inline bar", "Card", "Full bleed"],
    tierFloor: 0,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "button"],
  },
  spacer: {
    name: "Spacer / divider",
    category: "Structural",
    variants: ["Thin", "Thick", "With icon"],
    tierFloor: 0,
    maxVariantIndexByTier: [0, 2],
    elements: [],
  },
  featured_collection: {
    name: "Featured collection",
    category: "Catalog",
    variants: ["Grid", "Carousel"],
    tierFloor: 1,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "image"],
  },
  gallery: {
    name: "Gallery",
    category: "Content",
    variants: ["Grid", "Masonry", "Carousel"],
    tierFloor: 1,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "image"],
  },
  video_banner: {
    name: "Video banner",
    category: "Marketing",
    variants: ["Full bleed", "Split"],
    tierFloor: 1,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "text"],
  },
  countdown: {
    name: "Countdown",
    category: "Marketing",
    variants: ["Banner", "Hero overlay"],
    tierFloor: 1,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "text"],
  },
  stats_counter: {
    name: "Stats / counter",
    category: "Social proof",
    variants: ["Row of 4", "Row of 3"],
    tierFloor: 1,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading"],
  },
  logo_cloud: {
    name: "Trust badges",
    category: "Social proof",
    variants: ["Row", "Marquee"],
    tierFloor: 1,
    maxVariantIndexByTier: [0, 1],
    elements: [],
  },
  team: {
    name: "Team",
    category: "Content",
    variants: ["Grid", "Carousel"],
    tierFloor: 2,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "image"],
  },
  before_after: {
    name: "Before / after",
    category: "Social proof",
    variants: ["Slider", "Side by side"],
    tierFloor: 2,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "image"],
  },
  map_location: {
    name: "Map / location",
    category: "Content",
    variants: ["Embed map", "Address card"],
    tierFloor: 2,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "text"],
  },
  social_feed: {
    name: "Social feed",
    category: "Social proof",
    variants: ["Instagram grid (placeholder)"],
    tierFloor: 2,
    maxVariantIndexByTier: [0, 0],
    elements: ["heading"],
  },
  sticky_cta: {
    name: "Sticky CTA",
    category: "Marketing",
    variants: ["Bottom bar", "Corner badge"],
    tierFloor: 2,
    maxVariantIndexByTier: [0, 1],
    elements: ["text", "button"],
  },
  shape_divider: {
    name: "Shape divider",
    category: "Structural",
    variants: ["Wave", "Angle", "Curve"],
    tierFloor: 2,
    maxVariantIndexByTier: [0, 1],
    elements: [],
  },
  comparison_table: {
    name: "Comparison table",
    category: "Catalog",
    variants: ["2 column", "3 column"],
    tierFloor: 2,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading"],
  },
  blog_highlight: {
    name: "Blog / press",
    category: "Content",
    variants: ["Grid", "List"],
    tierFloor: 2,
    maxVariantIndexByTier: [0, 1],
    elements: ["heading", "image"],
  },
};

export const ALL_SECTION_IDS = Object.keys(SECTION_CATALOG) as SectionId[];

export interface AnimationCatalogEntry {
  label: string;
  category: string;
  tierFloor: number;
}

export const ANIMATION_CATALOG: Record<AnimationId, AnimationCatalogEntry> = {
  none: { label: "None", category: "—", tierFloor: 0 },
  "fade-up": { label: "Fade Up", category: "Entrance", tierFloor: 0 },
  "fade-in": { label: "Fade In", category: "Entrance", tierFloor: 1 },
  "slide-in": { label: "Slide In", category: "Entrance", tierFloor: 1 },
  "scale-in": { label: "Scale In", category: "Entrance", tierFloor: 1 },
  "stagger-reveal": { label: "Stagger Reveal", category: "Entrance · list", tierFloor: 1 },
  "hover-lift": { label: "Hover Lift", category: "Micro-interaction", tierFloor: 1 },
  "ken-burns": { label: "Image Ken Burns", category: "Image", tierFloor: 2 },
  "text-split": { label: "Text Split Reveal", category: "Text", tierFloor: 2 },
  parallax: { label: "Parallax Drift", category: "Scroll", tierFloor: 2 },
  magnetic: { label: "Magnetic Button", category: "Micro-interaction", tierFloor: 2 },
  "glass-reveal": { label: "Glass / Blur Reveal", category: "Glass", tierFloor: 2 },
  "gradient-shift": { label: "Gradient Shift", category: "Background", tierFloor: 2 },
  "sticky-pin": { label: "Sticky Pin", category: "Section transition", tierFloor: 2 },
  lottie: { label: "Lottie Playback", category: "Illustration", tierFloor: 2 },
};

export const ALL_ANIMATION_IDS = Object.keys(ANIMATION_CATALOG) as AnimationId[];

export function maxAllowedVariantIndex(sectionId: SectionId, sellerTierOrder: number): number {
  const entry = SECTION_CATALOG[sectionId];
  if (sellerTierOrder >= 2) return entry.variants.length - 1;
  return entry.maxVariantIndexByTier[Math.min(sellerTierOrder, 1) as 0 | 1];
}

export function tierName(tierOrder: number): string {
  return ["GO", "RUN", "RISE", "FLY"][tierOrder] ?? "GO";
}
