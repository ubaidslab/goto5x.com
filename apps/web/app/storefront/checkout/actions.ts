"use server";

import { LocalCartItem } from "../../../lib/local-cart";

/**
 * FR-32.1/FR-15.1 - server-to-server calls, same CORS reasoning as
 * order-status/actions.ts's submitReview: a tenant's dynamic
 * subdomain/custom domain can never be pre-listed in the API's static CORS
 * allowlist, so every buyer-facing submission routes through a Server Action.
 */

export interface ShippingAddressInput {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  country: string;
  postalCode?: string;
  phone: string;
}

interface ApiError {
  ok: false;
  error: string;
}

function extractError(body: { message?: string | string[] }, fallback: string): string {
  return typeof body.message === "string" ? body.message : Array.isArray(body.message) ? body.message.join(", ") : fallback;
}

/** FR-15.1 - the one and only point a server-side cart row is created. */
export async function createCartSession(
  hostname: string,
  buyerEmail: string,
  items: LocalCartItem[],
): Promise<{ ok: true; sessionToken: string } | ApiError> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hostname,
      buyerEmail,
      items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
    }),
  });
  const body = await res.json().catch(() => ({}) as { message?: string | string[] });
  if (!res.ok) return { ok: false, error: extractError(body, "Couldn't start checkout - please try again.") };
  return { ok: true, sessionToken: body.sessionToken };
}

/** FR-32.1 - completes the order; the resulting order is always `pending` (Financial Truth Invariant, §3.12). */
export async function submitCheckout(
  hostname: string,
  sessionToken: string,
  shippingAddress: ShippingAddressInput,
  discountCode?: string,
): Promise<{ ok: true; statusLookupToken: string } | ApiError> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostname, sessionToken, shippingAddress, discountCode: discountCode || undefined }),
  });
  const body = await res.json().catch(() => ({}) as { message?: string | string[] });
  if (!res.ok) return { ok: false, error: extractError(body, "Couldn't place your order - please try again.") };
  return { ok: true, statusLookupToken: body.statusLookupToken };
}
