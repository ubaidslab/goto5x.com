/**
 * SRS FR-1.5 (v0.9) - the one, binding SEO fallback chain: null `seoTitle`
 * renders the entity's own name/title; null `seoDescription` derives from
 * the entity's own description (truncated), or the parent store's default
 * if the entity has neither. FR-16.6's structured-data/OG tags read from
 * this same function's output - never a second, parallel set of SEO data.
 */

const DESCRIPTION_TRUNCATE_LENGTH = 160;

export interface SeoFallbackInput {
  seoTitle?: string | null;
  seoDescription?: string | null;
  fallbackName: string;
  fallbackDescription?: string | null;
  storeDefault?: { seoTitle?: string | null; seoDescription?: string | null } | null;
}

export interface SeoFallbackResult {
  title: string;
  description: string | null;
}

export function resolveSeoFallback(input: SeoFallbackInput): SeoFallbackResult {
  const title = input.seoTitle?.trim() || input.fallbackName;

  let description: string | null = input.seoDescription?.trim() || null;
  if (!description && input.fallbackDescription?.trim()) {
    description = truncate(input.fallbackDescription, DESCRIPTION_TRUNCATE_LENGTH);
  }
  if (!description && input.storeDefault?.seoDescription?.trim()) {
    description = input.storeDefault.seoDescription.trim();
  }
  return { title, description };
}

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Module 58 (SRS §5.65, FR-65.1/65.2) - extends the same cascade above to
 * the advanced per-item fields: an unset boolean toggle inherits the
 * store-level default (Store.seoRobotsIndexDefault etc.), never a
 * hardcoded true/false; OG title/description fall back to the already-
 * resolved basic seo.title/seo.description (never to the raw fallbackName/
 * fallbackDescription a second time - one resolved value, reused). Never a
 * second, parallel SEO data path - canonicalUrl/ogImageUrl/slug have no
 * fallback concept and pass through as-is (null when unset).
 */
export interface AdvancedSeoInput {
  canonicalUrl?: string | null;
  robotsIndex?: boolean | null;
  robotsFollow?: boolean | null;
  ogImageUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  /** Absent entirely for Collection - see Product.structuredDataEnabled's schema comment on why. */
  structuredDataEnabled?: boolean | null;
  sitemapIncluded?: boolean | null;
  storeDefault: {
    robotsIndex: boolean;
    robotsFollow: boolean;
    structuredDataEnabled: boolean;
    sitemapIncluded: boolean;
  };
  /** The already-resolved basic seo.title/seo.description this item's OG tags fall back to when unset. */
  resolvedSeo: SeoFallbackResult;
}

export interface AdvancedSeoResult {
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogImageUrl: string | null;
  ogTitle: string;
  ogDescription: string | null;
  structuredDataEnabled: boolean;
  sitemapIncluded: boolean;
}

export function resolveAdvancedSeo(input: AdvancedSeoInput): AdvancedSeoResult {
  return {
    canonicalUrl: input.canonicalUrl?.trim() || null,
    robotsIndex: input.robotsIndex ?? input.storeDefault.robotsIndex,
    robotsFollow: input.robotsFollow ?? input.storeDefault.robotsFollow,
    ogImageUrl: input.ogImageUrl ?? null,
    ogTitle: input.ogTitle?.trim() || input.resolvedSeo.title,
    ogDescription: input.ogDescription?.trim() || input.resolvedSeo.description,
    structuredDataEnabled: input.structuredDataEnabled ?? input.storeDefault.structuredDataEnabled,
    sitemapIncluded: input.sitemapIncluded ?? input.storeDefault.sitemapIncluded,
  };
}
