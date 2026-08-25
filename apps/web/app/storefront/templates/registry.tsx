import { atelierSections } from "./atelier";
import { baseSections } from "./base";
import {
  BeforeAfterSection,
  BlogHighlightSection,
  ComparisonTableSection,
  CountdownSection,
  FeaturedCollectionSection,
  FooterContactSection,
  GallerySection,
  LogoCloudSection,
  MapLocationSection,
  ShapeDividerSection,
  SocialFeedSection,
  SpacerSection,
  StatsCounterSection,
  StickyCtaSection,
  TeamSection,
  TestimonialsSection,
  VideoBannerSection,
} from "./dstudio-sections";
import { editorialSections } from "./editorial";
import { marketSections } from "./market";
import { studioSections } from "./studio";
import { TemplateSectionSet } from "./types";

/**
 * D-Studio v1 - the 17 new section types are shared across every template
 * (one component set, not one per template - see dstudio-sections/index.tsx's
 * top-of-file note on why). Spread onto each template-specific 5 below, so
 * `TemplateSectionSet` stays one full 22-key shape per template without
 * touching editorial.tsx/atelier.tsx/studio.tsx/market.tsx/base.tsx for the
 * new keys - only their own original 5 gained variant/animation support.
 */
const SHARED_SECTIONS = {
  Testimonials: TestimonialsSection,
  FooterContact: FooterContactSection,
  Spacer: SpacerSection,
  FeaturedCollection: FeaturedCollectionSection,
  Gallery: GallerySection,
  VideoBanner: VideoBannerSection,
  Countdown: CountdownSection,
  StatsCounter: StatsCounterSection,
  LogoCloud: LogoCloudSection,
  Team: TeamSection,
  BeforeAfter: BeforeAfterSection,
  MapLocation: MapLocationSection,
  SocialFeed: SocialFeedSection,
  StickyCta: StickyCtaSection,
  ShapeDivider: ShapeDividerSection,
  ComparisonTable: ComparisonTableSection,
  BlogHighlight: BlogHighlightSection,
} as const;

/**
 * Template Package Spec (docs/architecture.md) - name -> component-set
 * mapping. The storefront page (app/storefront/page.tsx) and the
 * customizer's live preview (app/(dashboard)/stores/[storeId]/customizer/
 * page.tsx) both call this SAME function, so "live preview output matches
 * published output exactly" (SRS §14.1) holds by construction - one lookup,
 * not two copies that could drift.
 *
 * THE ISOLATION RULE, enforced here structurally: every value in this map
 * is a `TemplateSectionSet` (types.ts) - pure presentational components
 * receiving already-fetched display data as props. None of them import
 * from, or can reach, cart/checkout/order-status/wallet/verification code -
 * that machinery lives entirely outside this `templates/` directory, in
 * its own page trees (app/storefront/cart, /checkout, /order-status, the
 * dashboard's wallet/order-verification screens). scripts/
 * check-template-isolation.js statically enforces this boundary in CI: no
 * file under this directory may import from those paths, full stop -
 * dstudio-sections/ lives under this same directory, so it's covered by
 * that exact same scan with zero script changes needed.
 */
const REGISTRY: Record<string, TemplateSectionSet> = {
  Editorial: { ...editorialSections, ...SHARED_SECTIONS },
  Studio: { ...studioSections, ...SHARED_SECTIONS },
  Market: { ...marketSections, ...SHARED_SECTIONS },
  Atelier: { ...atelierSections, ...SHARED_SECTIONS },
  "Start from blank": { ...baseSections, ...SHARED_SECTIONS },
};

export function getTemplateSections(themeName: string): TemplateSectionSet {
  return REGISTRY[themeName] ?? { ...baseSections, ...SHARED_SECTIONS };
}
