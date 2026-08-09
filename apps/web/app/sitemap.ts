import { MetadataRoute } from "next";
import { headers } from "next/headers";
import { fetchStorefrontCollections, fetchStorefrontProducts, fetchStorefrontStore } from "../lib/storefront-api";

// SRS FR-1.5/v0.9 - generated dynamically per request from live data, no
// static file, no cron. Reads the Host header directly (not rewritten by
// middleware.ts - see its top comment) so this works for both a tenant
// hostname and the platform's own (which simply resolves to no store,
// producing an empty sitemap - the platform's own site sitemap is Module
// 18's job, out of scope here). Module 5 extends this with collection
// pages, exactly as FR-1.5's v0.9 note anticipated - not a redesign.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  // A coming_soon/password_protected store gets no sitemap at all (founder
  // decision, SRS FR-1.5 v0.9) - same for "no store resolves at all".
  if (!store || store.accessMode !== "public") return [];

  const base = `https://${store.canonicalHostname}`;
  const [products, collections] = await Promise.all([
    fetchStorefrontProducts(host),
    fetchStorefrontCollections(host),
  ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    // Module 58 (SRS §5.65, FR-65.2) - a seller-set sitemapIncluded=false
    // excludes an item; the URL is always the existing id-based route
    // (a set Product.slug is a canonical-URL/SEO enhancement, not a
    // routing change - FR-65.3 is deliberately additive-only).
    ...(products ?? [])
      .filter((product) => product.sitemapIncluded)
      .map((product) => ({
        url: `${base}/products/${product.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...collections
      .filter((collection) => collection.sitemapIncluded)
      .map((collection) => ({
        url: `${base}/collections/${collection.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
  ];
}
