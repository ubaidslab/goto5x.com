export interface PublicStore {
  id: string;
  name: string;
  slug: string;
  currency: string;
  accessMode: "public" | "coming_soon" | "password_protected";
  canonicalHostname: string;
  seoTitle: string;
  seoDescription: string | null;
  /** FR-32.5 - null when no logo is set; consuming surfaces fall back to a typographic mark. */
  logoUrl: string | null;
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

export interface PublicCollection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  seoTitle: string;
  seoDescription: string | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

export interface NavigationItem {
  type: "link" | "text_block" | "social_links";
  label?: string;
  targetType?: "collection" | "content_page" | "external";
  targetId?: string;
  url?: string;
  body?: string | Record<string, string>;
}

export interface PublicNavigation {
  header: NavigationItem[];
  footer: NavigationItem[];
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

function unlockQuery(unlockToken?: string): string {
  return unlockToken ? `&unlockToken=${encodeURIComponent(unlockToken)}` : "";
}

/**
 * Returns `null` (not `[]`) on a 403 so callers can tell "gated, show the
 * coming-soon/password page" apart from "genuinely zero products" - the
 * gate itself is decided from `PublicStore.accessMode` before this is ever
 * called, but a stale/expired unlockToken can still 403 here.
 */
export async function fetchStorefrontProducts(hostname: string, unlockToken?: string): Promise<PublicProduct[] | null> {
  const res = await fetch(
    `${API_BASE}/storefront/products?hostname=${encodeURIComponent(hostname)}${unlockQuery(unlockToken)}`,
    { cache: "no-store" },
  );
  if (res.status === 403) return null;
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStorefrontProduct(
  hostname: string,
  productId: string,
  unlockToken?: string,
): Promise<PublicProduct | null> {
  const res = await fetch(
    `${API_BASE}/storefront/products/${encodeURIComponent(productId)}?hostname=${encodeURIComponent(hostname)}${unlockQuery(unlockToken)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStorefrontCollections(hostname: string, unlockToken?: string): Promise<PublicCollection[]> {
  const res = await fetch(
    `${API_BASE}/storefront/collections?hostname=${encodeURIComponent(hostname)}${unlockQuery(unlockToken)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStorefrontCollection(
  hostname: string,
  collectionId: string,
  unlockToken?: string,
): Promise<(PublicCollection & { products: PublicProduct[] }) | null> {
  const res = await fetch(
    `${API_BASE}/storefront/collections/${encodeURIComponent(collectionId)}?hostname=${encodeURIComponent(hostname)}${unlockQuery(unlockToken)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStorefrontCategories(hostname: string): Promise<PublicCategory[]> {
  const res = await fetch(`${API_BASE}/storefront/categories?hostname=${encodeURIComponent(hostname)}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStorefrontNavigation(hostname: string): Promise<PublicNavigation> {
  const res = await fetch(`${API_BASE}/storefront/navigation?hostname=${encodeURIComponent(hostname)}`, {
    cache: "no-store",
  });
  if (!res.ok) return { header: [], footer: [] };
  return res.json();
}

export interface SearchParams {
  q?: string;
  minPrice?: string;
  maxPrice?: string;
  categoryId?: string;
  collectionId?: string;
}

export async function fetchStorefrontSearch(
  hostname: string,
  params: SearchParams,
  unlockToken?: string,
): Promise<PublicProduct[] | null> {
  const query = new URLSearchParams({ hostname, ...params });
  if (unlockToken) query.set("unlockToken", unlockToken);
  const res = await fetch(`${API_BASE}/storefront/search?${query.toString()}`, { cache: "no-store" });
  if (res.status === 403) return null;
  if (!res.ok) return [];
  return res.json();
}

export interface PublicOrderTrackingUpdate {
  trackingId: string;
  carrier: string | null;
  uploadedAt: string;
}

export interface PublicOrderItem {
  productId: string;
  productTitle: string;
  quantity: number;
  unitPrice: string;
  fulfillmentStatus: string;
  trackingUpdates: PublicOrderTrackingUpdate[];
}

export interface PublicOrderStatus {
  status: "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | "disputed";
  placedAt: string;
  currency: string;
  invoicePdfUrl: string | null;
  totalAmount: string;
  shippingAmount: string;
  taxAmount: string;
  discountAmount: string;
  shippingAddress: { fullName: string; line1: string; line2?: string; city: string; country: string; postalCode?: string; phone: string };
  paymentInstructions: {
    bankAccountTitle: string | null;
    bankAccountNumber: string | null;
    bankName: string | null;
    jazzcashNumber: string | null;
    easypaisaNumber: string | null;
    codEnabled: boolean;
  } | null;
  items: PublicOrderItem[];
}

/** FR-5.4 - the buyer's only post-checkout reference; public, keyed purely by the unguessable token. */
export async function fetchStorefrontOrderStatus(token: string): Promise<PublicOrderStatus | null> {
  const res = await fetch(`${API_BASE}/storefront/order-status/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function unlockStorefront(hostname: string, password: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/storefront/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostname, password }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.unlockToken as string;
}
