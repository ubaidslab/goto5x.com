import { MetadataRoute } from "next";
import { headers } from "next/headers";
import { fetchStorefrontProducts, fetchStorefrontStore } from "../lib/storefront-api";

// SRS FR-1.5/v0.9 - generated dynamically per request from live data, no
// static file, no cron. Reads the Host header directly (not rewritten by
// middleware.ts - see its top comment) so this works for both a tenant
// hostname and the platform's own (which simply resolves to no store,
// producing an empty sitemap - the platform's own site sitemap is Module
// 16's job, out of scope here).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);
  // A coming_soon/password_protected store gets no sitemap at all (founder
  // decision, SRS FR-1.5 v0.9) - same for "no store resolves at all".
  if (!store || store.accessMode !== "public") return [];

  const base = `https://${store.canonicalHostname}`;
  const products = await fetchStorefrontProducts(host);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...products.map((product) => ({
      url: `${base}/products/${product.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
