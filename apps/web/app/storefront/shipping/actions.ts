"use server";

/**
 * FR-66.4 (Module 84) - shipping cost calculator, same Server-Action-only
 * discipline as checkout/chat actions (a tenant's dynamic subdomain/custom
 * domain can never be pre-listed in the API's static CORS allowlist).
 */

interface ApiError {
  ok: false;
  error: string;
}

interface ShippingQuoteItem {
  productId: string;
  variantId: string;
  quantity: number;
}

function extractError(body: { message?: string | string[] }, fallback: string): string {
  return typeof body.message === "string" ? body.message : Array.isArray(body.message) ? body.message.join(", ") : fallback;
}

export async function getShippingQuoteAction(
  hostname: string,
  items: ShippingQuoteItem[],
): Promise<
  | { ok: true; subtotal: number; shippingAmount: number; freeShippingThreshold: number | null; amountUntilFreeShipping: number | null }
  | ApiError
> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/cart/shipping-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostname, items }),
  });
  const json = await res.json().catch(() => ({}) as { message?: string | string[] });
  if (!res.ok) return { ok: false, error: extractError(json, "Couldn't estimate shipping.") };
  return {
    ok: true,
    subtotal: json.subtotal,
    shippingAmount: json.shippingAmount,
    freeShippingThreshold: json.freeShippingThreshold,
    amountUntilFreeShipping: json.amountUntilFreeShipping,
  };
}
