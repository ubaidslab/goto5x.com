import { PublicProduct, PublicStore } from "../../../lib/storefront-api";
import { FaqItem, ResolvedThemeSettings } from "../../../lib/theme-presets";

/**
 * Template Package Spec (docs/architecture.md) - the shared "shape" every
 * built-in template's own section-component set must implement. Presentation
 * only: props are read-only display data (store/product fields already
 * fetched by the page, resolved theme tokens) - never a mutation, never a
 * fetch/API-call function, by construction. See registry.tsx's isolation
 * note for what this buys.
 */
export interface TemplateSectionSet {
  Hero: (props: { store: PublicStore; theme: ResolvedThemeSettings }) => JSX.Element;
  FeaturedProducts: (props: { products: PublicProduct[]; theme: ResolvedThemeSettings }) => JSX.Element;
  About: (props: { store: PublicStore; theme: ResolvedThemeSettings }) => JSX.Element;
  Newsletter: (props: { theme: ResolvedThemeSettings }) => JSX.Element;
  Faq: (props: { theme: ResolvedThemeSettings; items: FaqItem[] }) => JSX.Element | null;
}
