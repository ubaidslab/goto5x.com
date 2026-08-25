import { PublicCollection, PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { AnimationId, ElementSlot, FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";

/**
 * D-Studio v1 - every section component now also receives `variant`
 * (lib/section-catalog.ts's per-section layout list) and `elementAnimations`
 * (a per-element-slot GSAP preset id, applied via components/motion/
 * AnimatedElement.tsx). Both are optional so the original 5's pre-D-Studio
 * callers (none remain, but kept defensive) still type-check.
 */
export interface DStudioSectionProps {
  variant?: number;
  elementAnimations?: Partial<Record<ElementSlot, AnimationId>>;
}

/**
 * Template Package Spec (docs/architecture.md) - the shared "shape" every
 * built-in template's own section-component set must implement. Presentation
 * only: props are read-only display data (store/product fields already
 * fetched by the page, resolved theme tokens) - never a mutation, never a
 * fetch/API-call function, by construction. See registry.tsx's isolation
 * note for what this buys.
 *
 * The original 5 keep bespoke per-template implementations (their own
 * fonts/spacing/photography treatment); the 17 new D-Studio v1 keys are
 * shared, theme-token-driven components (templates/dstudio-sections/) that
 * every template's registry entry points at identically - see registry.tsx.
 */
export interface TemplateSectionSet {
  Hero: (props: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  FeaturedProducts: (props: { products: PublicProduct[]; theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  About: (props: { store: PublicStore; theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  Newsletter: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  Faq: (props: { theme: ResolvedThemeSettings; items: FaqItem[] } & DStudioSectionProps) => JSX.Element | null;

  Testimonials: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  FooterContact: (props: { theme: ResolvedThemeSettings; store: PublicStore } & DStudioSectionProps) => JSX.Element;
  Spacer: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  FeaturedCollection: (props: { theme: ResolvedThemeSettings; collection: (PublicCollection & { products: PublicProduct[] }) | null } & DStudioSectionProps) => JSX.Element | null;
  Gallery: (props: { theme: ResolvedThemeSettings; images: { url: string }[] } & DStudioSectionProps) => JSX.Element;
  VideoBanner: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  Countdown: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  StatsCounter: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  LogoCloud: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  Team: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  BeforeAfter: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  MapLocation: (props: { theme: ResolvedThemeSettings; store: PublicStore } & DStudioSectionProps) => JSX.Element;
  SocialFeed: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  StickyCta: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  ShapeDivider: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
  ComparisonTable: (props: { theme: ResolvedThemeSettings; products: PublicProduct[] } & DStudioSectionProps) => JSX.Element;
  BlogHighlight: (props: { theme: ResolvedThemeSettings } & DStudioSectionProps) => JSX.Element;
}
