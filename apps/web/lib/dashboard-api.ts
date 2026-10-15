"use client";

/**
 * One shared fetch wrapper for every seller-dashboard screen (Module 10) -
 * consistent auth-header attachment and error shape, so a screen author
 * never hand-rolls token-storage + header plumbing again (that repeated-by-
 * hand pattern is what Modules 2/5/7's bare functional pages did, and is
 * exactly the inconsistency this module exists to remove - SRS FR-28.3).
 *
 * D82 - the access token now lives ONLY in this module's own in-memory
 * variable (never localStorage, not even sessionStorage - "nothing may
 * remain in localStorage" is stated as an absolute by the founder's own
 * decision). The refresh token moved to a __Host-refresh_token cookie the
 * API sets/reads directly - this module never sees its value at all, only
 * `credentials: "include"` so the browser attaches it automatically, and
 * `X-Requested-With` so RefreshCookieCsrfGuard accepts the call. A fresh
 * page load starts with no in-memory token, which is fine: the first
 * request below 401s with no Authorization header, `request()`'s existing
 * retry-after-refresh logic calls POST /auth/refresh (cookie-authenticated,
 * no explicit "am I logged in" check needed first), and succeeds exactly
 * as if the token had been there all along.
 */

import { getApiErrorMessage } from "./api-error";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
// FR-25.7 self-service session list (settings page) needs to know which
// listed session is "this one" - getCurrentSessionId() below is the read
// path; nothing else in the app needs this value.
let currentSessionId: string | null = null;

/**
 * Called after login/mfa-verify/impersonate-entry - every place a fresh
 * access token is issued. `sessionId` is omitted by impersonate/page.tsx
 * (a new tab with no self-service-session-list concept of its own; see
 * that file's own comment for why it calls this directly rather than going
 * through a normal login flow).
 */
export function setSession(token: string | null, sessionId: string | null = null): void {
  accessToken = token;
  currentSessionId = sessionId;
}

export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/**
 * Founder walkthrough finding (pre-Milestone-A, Phase 0.5) - a 15-minute
 * access token (JWT_ACCESS_TTL_MINUTES) had nothing behind it originally.
 * `refreshPromise` is shared across concurrent callers so a burst of
 * requests that all 401 at once triggers exactly one refresh (POST
 * /auth/refresh rotates the refresh-token cookie, so a second concurrent
 * call against the now-stale cookie would itself fail).
 */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = await res.json();
        accessToken = body.accessToken;
        currentSessionId = body.sessionId;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function clearSessionAndRedirectToLogin() {
  accessToken = null;
  currentSessionId = null;
  if (typeof window === "undefined") return;
  window.location.href = "/login";
}

/**
 * Real session revocation (POST /auth/logout), not just a client-side
 * token-forget - best-effort: a failed/offline revoke call still clears
 * local state and redirects, since the user's intent to leave shouldn't be
 * blocked by a network hiccup. No body needed - the API reads which
 * session to destroy from the same cookie the request carries.
 */
async function logout() {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  }).catch(() => {});
  clearSessionAndRedirectToLogin();
}

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  // FormData bodies must let the browser set their own multipart boundary -
  // forcing application/json here would break upload() below.
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (res.status === 401 && !isRetry && path !== "/auth/refresh") {
    if (await tryRefresh()) {
      return request<T>(path, init, true);
    }
    clearSessionAndRedirectToLogin();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(getApiErrorMessage(body, res.statusText), res.status);
  }

  // A 204, or any handler that returns void (NestJS still answers 200, not
  // 204, for those - e.g. ReviewsService.moderate()), reaches here with an
  // empty body. res.json() throws SyntaxError on empty input, which isn't
  // an ApiError, so every caller's catch block would show a generic
  // "couldn't do that" message on an action that actually succeeded -
  // checked by status text length, not res.status, so it's correct
  // regardless of which status code a void-returning handler answers with.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Module 24 security fix (v0.28) - export files require the Bearer token
 * this API uses throughout (no cookie auth exists for regular routes), so a
 * plain `<a href>` can't hit an authenticated download route. This fetches
 * the bytes with the same auth header as every other request, then the
 * caller triggers the actual browser save via a blob object URL.
 */
async function download(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: authHeaders() });
  if (!res.ok) {
    throw new ApiError(res.statusText, res.status);
  }
  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData }),
  download,
  logout,
  setSession,
  getCurrentSessionId,
};
