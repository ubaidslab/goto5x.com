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
  /** Module 23 (SRS §5.35, FR-35.4) - the Verified Store Program's live badge flag. */
  verified: boolean;
  /** Templates module (v0.31 design phase) - server-resolved; mandatory on Free, removable only on a paid plan (branding.powered_by_removable/hidden). */
  poweredByVisible: boolean;
  /** FR-66.3 (Module 83) - server-resolved plan gate (RISE+FLY); the storefront only renders the chat widget when true. */
  chatEnabled: boolean;
  /** FR-66.5 (Module 85) - same RISE+FLY plan gate as chatEnabled; the storefront only renders the wishlist button/nav link when true. */
  wishlistEnabled: boolean;
  /** FR-66.6 (Module 86) - the same store-scoped inventory.low_stock_threshold Module 28 already uses for the seller's own low-stock alerting; a variant at or under this (and above 0) shows the stock-countdown urgency message. */
  lowStockThreshold: number;
  theme: { name: string; settings: Record<string, unknown> } | null;
  // Module 58 (SRS §5.65, FR-65.1/65.5) - store-level defaults product/
  // collection pages fall back to when their own toggle is unset.
  seoRobotsIndexDefault: boolean;
  seoRobotsFollowDefault: boolean;
  seoStructuredDataDefault: boolean;
  seoSitemapIncludedDefault: boolean;
  /** FR-65.4 - already sanitized server-side; safe to inject into <head> as-is. */
  customHeadTags: string | null;
}

export interface PublicProduct {
  id: string;
  title: string;
  description: string | null;
  averageRating: string | number;
  reviewCount: number;
  variants: { id: string; sku: string; price: string; stockQuantity: number; trackInventory: boolean }[];
  media: { id: string; url: string; type: string }[];
  seoTitle: string;
  seoDescription: string | null;
  /** FR-4.6/FR-40.1 - null for self-fulfilled products (no supplier listing behind them). */
  supplierShipping: {
    shippingCost: string | number;
    estimatedDeliveryMinDays: number;
    estimatedDeliveryMaxDays: number;
    supportedCountries: string[];
  } | null;
  // Module 58 (SRS §5.65, FR-65.1-65.3) - already resolved server-side
  // against the store defaults above (StorefrontService.toPublicProduct()).
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogImageUrl: string | null;
  ogTitle: string;
  ogDescription: string | null;
  structuredDataEnabled: boolean;
  sitemapIncluded: boolean;
  /** FR-65.3 - additive only; the `id`-based route above is never replaced. */
  slug: string | null;
  /** SRS §5.69/FR-69.1/69.3 (Module 94) - ordered, non-variant, buyer-facing by default. */
  customAttributes: { key: string; value: string }[];
}

export interface PublicCollection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  seoTitle: string;
  seoDescription: string | null;
  // Module 58 (SRS §5.65, FR-65.1/65.2) - see PublicProduct's comment; no
  // structuredDataEnabled here (collections have no existing JSON-LD).
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogImageUrl: string | null;
  ogTitle: string;
  ogDescription: string | null;
  sitemapIncluded: boolean;
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
  trackingUrl: string | null;
  uploadedAt: string;
}

// SRS §5.38/FR-38.7 (founder batch, "Honest Delivery Tracking") - the
// buyer-facing 4-state bucket, a pure mapping of the real order status.
export type BuyerFacingTrackingState = "pending" | "submitted_to_courier" | "delivered" | "cancelled";

export interface PublicOrderItem {
  productId: string;
  productTitle: string;
  quantity: number;
  unitPrice: string;
  fulfillmentStatus: string;
  trackingUpdates: PublicOrderTrackingUpdate[];
}

export interface OrderTimelineStage {
  stage: "placed" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";
  label: string;
  completedAt: string | null;
}

/** Module 53 (SRS §5.60/FR-60.1) - a buyer-facing projection of ReturnRequest. */
export interface PublicReturnRequest {
  id: string;
  status: "requested" | "approved" | "rejected" | "completed";
  buyerReason: string;
  sellerNote: string | null;
  refundAmount: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

type PublicOrderStatusValue =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "disputed"
  | "refunded"
  | "partially_refunded";

/**
 * SRS §5.38/FR-38.9 (founder batch, "Honest Delivery Tracking") - once a
 * delivered order sits past `orders.delivered_archive_days`, the API
 * collapses this response to this minimal shape instead of the full one
 * below. Display simplification only - the underlying order is untouched.
 */
export interface PublicOrderStatusArchived {
  archived: true;
  status: PublicOrderStatusValue;
  placedAt: string;
  trackingState: BuyerFacingTrackingState;
  trackingMessage: string;
  deliveredAt: string | null;
  currency: string;
  totalAmount: string;
  invoicePdfUrl: string | null;
  canRequestReturn: boolean;
  returnRequests: PublicReturnRequest[];
}

export interface PublicOrderStatusFull {
  archived: false;
  status: PublicOrderStatusValue;
  placedAt: string;
  timeline: OrderTimelineStage[];
  trackingState: BuyerFacingTrackingState;
  trackingMessage: string;
  currency: string;
  invoicePdfUrl: string | null;
  totalAmount: string;
  shippingAmount: string;
  taxAmount: string;
  discountAmount: string;
  shippingAddress: { fullName: string; line1: string; line2?: string; city: string; country: string; postalCode?: string; phone: string };
  // Module 95 (SRS §5.6l/FR-6.65) - the store's paymentModel snapshotted at
  // placement time, independent of `verification` below.
  paymentModel: "prepaid" | "cod" | "advance";
  // Launch-blocker fix (found while building Module 76's buyer UI) - this
  // was never exposed here at all, so there was nowhere for a buyer-facing
  // verification UI to even mount for ANY channel (not just Module 76's).
  // null means this order never needed verification.
  verification: {
    channel: "whatsapp_otp" | "email_otp" | "prepaid_confirmation" | "prepaid_partial_advance";
    status: "pending" | "verified" | "failed" | "expired";
  } | null;
  paymentInstructions: {
    bankAccountTitle: string | null;
    bankAccountNumber: string | null;
    bankName: string | null;
    jazzcashNumber: string | null;
    easypaisaNumber: string | null;
    codEnabled: boolean;
  } | null;
  items: PublicOrderItem[];
  // Module 53 (SRS §5.60/FR-60.2/60.6)
  canRequestReturn: boolean;
  returnRequests: PublicReturnRequest[];
}

export type PublicOrderStatus = PublicOrderStatusFull | PublicOrderStatusArchived;

/** FR-5.4 - the buyer's only post-checkout reference; public, keyed purely by the unguessable token. */
export async function fetchStorefrontOrderStatus(token: string): Promise<PublicOrderStatus | null> {
  const res = await fetch(`${API_BASE}/storefront/order-status/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

// Module 91 (SRS §5.67/FR-67.3) - a seller-created bundle of their own
// products sold together at one uniform percentage off. `discountedPrice`
// is computed server-side at the moment this response is built - it is
// informational display only, never trusted as the actual checkout
// discount (checkout.service.ts recomputes it live against current
// prices, same reasoning as the API's own doc comment on this method).
export interface PublicDealItem {
  productId: string;
  variantId: string;
  title: string;
  imageUrl: string | null;
  price: number;
  discountedPrice: number;
  inStock: boolean;
}

export interface PublicDeal {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  discountPercent: number;
  startsAt: string | null;
  endsAt: string | null;
  thumbnailUrl: string | null;
  items: PublicDealItem[];
}

export async function fetchStorefrontDeals(hostname: string): Promise<PublicDeal[]> {
  const res = await fetch(`${API_BASE}/storefront/deals?hostname=${encodeURIComponent(hostname)}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStorefrontDeal(hostname: string, dealId: string): Promise<PublicDeal | null> {
  const res = await fetch(
    `${API_BASE}/storefront/deals/${encodeURIComponent(dealId)}?hostname=${encodeURIComponent(hostname)}`,
    { cache: "no-store" },
  );
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
