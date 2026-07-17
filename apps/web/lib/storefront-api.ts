export interface PublicStore {
  id: string;
  name: string;
  slug: string;
  currency: string;
  accessMode: "public" | "coming_soon" | "password_protected";
  canonicalHostname: string;
  seoTitle: string;
  seoDescription: string | null;
  theme: { name: string; settings: Record<string, unknown> } | null;
}

export interface PublicProduct {
  id: string;
  title: string;
  description: string | null;
  averageRating: string | number;
  reviewCount: number;
  variants: { id: string; sku: string; price: string; stockQuantity: number }[];
  media: { id: string; url: string; type: string }[];
  seoTitle: string;
  seoDescription: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Server-side only - every storefront page/metadata function/sitemap/robots
 * file calls this with the *actual buyer-facing* hostname (from `headers()`
 * in the calling Server Component), not this Next.js server's own address.
 * Returns null on a 404 (no store for that hostname) rather than throwing,
 * so callers can decide between notFound() and a plain empty response.
 */
export async function fetchStorefrontStore(hostname: string): Promise<PublicStore | null> {
  const res = await fetch(`${API_BASE}/storefront/store?hostname=${encodeURIComponent(hostname)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStorefrontProducts(hostname: string): Promise<PublicProduct[]> {
  const res = await fetch(`${API_BASE}/storefront/products?hostname=${encodeURIComponent(hostname)}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStorefrontProduct(hostname: string, productId: string): Promise<PublicProduct | null> {
  const res = await fetch(
    `${API_BASE}/storefront/products/${encodeURIComponent(productId)}?hostname=${encodeURIComponent(hostname)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json();
}
