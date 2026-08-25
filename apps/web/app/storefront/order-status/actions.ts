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

/**
 * Launch-blocker fix (found while building Module 76's buyer UI, see
 * OrderVerificationPanel) - the OTP entry/resend actions for whatsapp_otp
 * and email_otp had no frontend anywhere at all; these three actions are
 * the missing bridge to OrderVerificationService's already-working
 * verifyByToken()/resendByToken() (via BuyerOrderVerificationController),
 * same Server Action reasoning as every other storefront mutation above.
 */
export async function submitVerificationCode(token: string, code: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/order-verification/${token}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    return { ok: false, message: typeof body.message === "string" ? body.message : "Incorrect or expired code." };
  }
  return { ok: true };
}

export async function resendVerificationCode(token: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/order-verification/${token}/resend`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    return { ok: false, message: typeof body.message === "string" ? body.message : "Couldn't resend a code right now." };
  }
  return { ok: true };
}

/** Module 76 (FR-6.52) - the partial-advance deposit amount + this store's active gateway options, bridging PaymentGatewayService.getPartialAdvanceOptionsByToken(). */
export async function getPartialAdvanceOptions(
  token: string,
): Promise<{ amount: number; currency: string; providers: string[] } | null> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/gateway-payment/${token}/partial-advance`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

/** Module 76 (FR-6.52) - charges the deposit via the chosen provider and, on a verified match, auto-confirms the order (PaymentGatewayService.verifyPartialAdvanceByToken()). */
export async function chargePartialAdvance(token: string, provider: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/gateway-payment/${token}/partial-advance/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    return { ok: false, message: typeof body.message === "string" ? body.message : "Payment could not be verified yet." };
  }
  return { ok: true };
}
