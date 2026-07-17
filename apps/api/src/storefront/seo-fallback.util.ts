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
