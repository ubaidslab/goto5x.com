import { MetadataRoute } from "next";
import { headers } from "next/headers";
import { fetchStorefrontStore } from "../lib/storefront-api";

// SRS FR-1.5/v0.9 - see app/sitemap.ts's comment for why this reads the
// Host header directly rather than going through middleware.ts.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = headers().get("host") ?? "";
  const store = await fetchStorefrontStore(host);

  // Hidden store, or hostname resolves to no store at all (e.g. the
  // platform's own site, out of scope until Module 16): disallow
  // everything, no sitemap link.
  if (!store || store.accessMode !== "public") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  const base = `https://${store.canonicalHostname}`;
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
