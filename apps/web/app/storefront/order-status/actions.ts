"use server";

/**
 * FR-14.1 - the review submission itself must never be a cross-origin
 * browser fetch: every tenant storefront lives on its own dynamic subdomain
 * or custom domain, so a static CORS allowlist (main.ts's
 * CORS_ALLOWED_ORIGINS, intentionally "no blanket wildcard") can never
 * include all of them. Routing through a Server Action keeps this a
 * server-to-server call - same reasoning as every other storefront data
 * fetch in this app already being server-side (lib/storefront-api.ts).
 */
export async function submitReview(
  token: string,
  input: { productId: string; buyerName: string; rating: number; body: string },
): Promise<{ ok: boolean; id?: string }> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/order-status/${token}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return { ok: false };
  const created = await res.json();
  return { ok: true, id: created.id };
}

/** Phase 4 close-out (FR-14.1) - a second step right after submitReview(), same Server Action reasoning (never a cross-origin browser upload straight to the API). */
export async function addReviewMedia(token: string, reviewId: string, files: File[]): Promise<{ ok: boolean }> {
  const formData = new FormData();
  for (const file of files) formData.append("media", file);
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/order-status/${token}/reviews/${reviewId}/media`, {
    method: "POST",
    body: formData,
  });
  return { ok: res.ok };
}

/** FR-60.2 - same Server Action reasoning as submitReview() above: never a cross-origin browser fetch. */
export async function submitReturnRequest(token: string, input: { reason: string }): Promise<{ ok: boolean }> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/order-status/${token}/returns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return { ok: res.ok };
}
