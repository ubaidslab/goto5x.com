"use server";

/**
 * FR-67.2/FR-15.1 - server-to-server call, same CORS reasoning as
 * checkout/actions.ts's createCartSession: a tenant's dynamic subdomain/
 * custom domain can never be pre-listed in the API's static CORS
 * allowlist, so this routes through a Server Action too.
 */

interface ApiError {
  ok: false;
  error: string;
}

function extractError(body: { message?: string | string[] }, fallback: string): string {
  return typeof body.message === "string" ? body.message : Array.isArray(body.message) ? body.message.join(", ") : fallback;
}

/**
 * FR-67.2 - pre-populates a real server-side Cart (tagged with the deal)
 * and hands back its sessionToken so the caller can continue straight into
 * the ordinary checkout flow's shipping step and `submitCheckout` action
 * (checkout/actions.ts) - completely unchanged from a normal cart checkout.
 */
export async function buyNowDeal(
  hostname: string,
  dealId: string,
  buyerEmail: string,
  buyerWhatsapp?: string,
): Promise<{ ok: true; sessionToken: string } | ApiError> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/deals/${dealId}/buy-now`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostname, buyerEmail, buyerWhatsapp: buyerWhatsapp || undefined }),
  });
  const body = await res.json().catch(() => ({}) as { message?: string | string[] });
  if (!res.ok) return { ok: false, error: extractError(body, "Couldn't start this deal - please try again.") };
  return { ok: true, sessionToken: body.sessionToken };
}
