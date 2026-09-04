"use server";

import { cookies } from "next/headers";

/**
 * FR-66.1 (Module 81) - buyer account auth, same Server-Action-only
 * discipline as checkout/actions.ts (a tenant's dynamic subdomain/custom
 * domain can never be pre-listed in the API's static CORS allowlist).
 *
 * The session is stored as an httpOnly cookie set here, never in
 * client-accessible storage - a real security improvement over the
 * seller dashboard's own localStorage pattern (dashboard-api.ts's own
 * comment: "no cookie auth exists" there), made possible because this
 * really does run same-origin to whatever the buyer is looking at.
 *
 * Known MVP limitation, called out honestly rather than silently: buyer
 * accounts are a global platform identity (one BuyerProfile row, order
 * history spans every store), but this cookie is inherently per-origin -
 * a buyer who logs in on one store's domain is NOT automatically logged
 * in on a different store's domain (a custom domain can never share a
 * cookie with a subdomain, or with another custom domain). The account
 * itself and its order history are still global once logged into any
 * one origin; only the "already logged in everywhere" convenience isn't
 * achievable without a shared platform-wide domain, which is out of
 * scope here.
 */

const COOKIE_NAME = "buyer_session";

interface BuyerSession {
  accessToken: string;
  sessionId: string;
  refreshToken: string;
}

interface ApiError {
  ok: false;
  error: string;
}

function extractError(body: { message?: string | string[] }, fallback: string): string {
  return typeof body.message === "string" ? body.message : Array.isArray(body.message) ? body.message.join(", ") : fallback;
}

function storeSession(session: BuyerSession) {
  cookies().set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // matches JWT_REFRESH_TTL_DAYS' default (30 days)
  });
}

export async function getBuyerSession(): Promise<BuyerSession | null> {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BuyerSession;
  } catch {
    return null;
  }
}

export async function buyerSignupAction(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ ok: true } | ApiError> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: displayName || undefined }),
  });
  const body = await res.json().catch(() => ({}) as { message?: string | string[] });
  if (!res.ok) return { ok: false, error: extractError(body, "Couldn't create your account - please try again.") };
  storeSession(body as BuyerSession);
  return { ok: true };
}

export async function buyerLoginAction(email: string, password: string): Promise<{ ok: true } | ApiError> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}) as { message?: string | string[] });
  if (!res.ok) return { ok: false, error: extractError(body, "Invalid email or password.") };
  storeSession(body as BuyerSession);
  return { ok: true };
}

export async function buyerLogoutAction(): Promise<void> {
  const session = await getBuyerSession();
  if (session) {
    await fetch(`${process.env.API_BASE_URL}/storefront/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId }),
    }).catch(() => {});
  }
  cookies().delete(COOKIE_NAME);
}

/** Called by any account Server Action that hits a 401 - the access token may have simply expired (15min TTL). */
async function refreshSession(session: BuyerSession): Promise<BuyerSession | null> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: session.sessionId, refreshToken: session.refreshToken }),
  });
  if (!res.ok) {
    cookies().delete(COOKIE_NAME);
    return null;
  }
  const fresh = (await res.json()) as BuyerSession;
  storeSession(fresh);
  return fresh;
}

/** Shared helper every authenticated buyer-account Server Action uses - attaches the bearer token, retries once on a 401 via refresh. */
export async function buyerAuthedFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  let session = await getBuyerSession();
  if (!session) return null;

  const doFetch = (token: string) =>
    fetch(`${process.env.API_BASE_URL}${path}`, {
      ...init,
      headers: { ...init.headers, "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });

  let res = await doFetch(session.accessToken);
  if (res.status === 401) {
    session = await refreshSession(session);
    if (!session) return null;
    res = await doFetch(session.accessToken);
  }
  return res;
}

export interface BuyerAddressInput {
  label?: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  country: string;
  postalCode?: string;
  phone: string;
  isDefault?: boolean;
}

export async function updateProfileAction(displayName: string): Promise<{ ok: true } | ApiError> {
  const res = await buyerAuthedFetch("/storefront/account/me", {
    method: "PATCH",
    body: JSON.stringify({ displayName: displayName || undefined }),
  });
  if (!res || !res.ok) return { ok: false, error: "Couldn't update your profile - please try again." };
  return { ok: true };
}

export async function createAddressAction(input: BuyerAddressInput): Promise<{ ok: true } | ApiError> {
  const res = await buyerAuthedFetch("/storefront/account/addresses", { method: "POST", body: JSON.stringify(input) });
  if (!res || !res.ok) return { ok: false, error: "Couldn't save this address - please try again." };
  return { ok: true };
}

export async function updateAddressAction(id: string, input: BuyerAddressInput): Promise<{ ok: true } | ApiError> {
  const res = await buyerAuthedFetch(`/storefront/account/addresses/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  if (!res || !res.ok) return { ok: false, error: "Couldn't save this address - please try again." };
  return { ok: true };
}

export async function deleteAddressAction(id: string): Promise<{ ok: true } | ApiError> {
  const res = await buyerAuthedFetch(`/storefront/account/addresses/${id}`, { method: "DELETE" });
  if (!res || !res.ok) return { ok: false, error: "Couldn't remove this address - please try again." };
  return { ok: true };
}
