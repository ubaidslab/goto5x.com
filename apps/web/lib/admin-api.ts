/**
 * Module 25 (Admin Completion) - one shared fetch wrapper for the admin
 * pages, mirroring `dashboard-api.ts`'s pattern for the seller dashboard.
 * Every admin page before this module hand-rolled its own
 * `localStorage.getItem("adminAccessToken")` + header plumbing (the same
 * inconsistency `dashboard-api.ts`'s own header documents for the seller
 * side) - this removes that duplication for every NEW admin page this
 * module adds. Existing admin pages are left as-is (out of this module's
 * scope to refactor 12 already-shipped, already-tested pages).
 *
 * D82 admin slice - mirrors dashboard-api.ts's own D82 fix exactly: the
 * access token and sessionId are in-memory only now, never localStorage.
 * The refresh token never reaches this module at all any more - it
 * travels as the __Host-admin_refresh_token cookie, set/read directly by
 * the API (admin-auth.controller.ts), never exposed to this JS.
 */

import { getApiErrorMessage } from "./api-error";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let currentSessionId: string | null = null;

/** Called by the login page (post-MFA) on success, and by logout()/a failed refresh to clear state. */
function setSession(token: string | null, sessionId?: string | null): void {
  accessToken = token;
  currentSessionId = sessionId ?? null;
}

function getCurrentSessionId(): string | null {
  return currentSessionId;
}

function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/**
 * Founder walkthrough finding (pre-Milestone-A, Phase 0.5) - no admin
 * refresh path existed at all, backend or frontend: the admin login page
 * only ever stored the access token, never a sessionId/refreshToken, and
 * nothing here would have used them if it had. A 15-minute access token
 * (JWT_ACCESS_TTL_MINUTES) with no refresh meant every admin session
 * hard-expired mid-walkthrough, showing the backend's bare "Unauthorized"
 * as inline content on every one of the ~30 admin terminal pages. See
 * AdminAuthService.refresh() for the new `POST /admin/auth/refresh`
 * endpoint this calls. Same shared-in-flight-promise shape as
 * dashboard-api.ts's tryRefresh() - a burst of concurrent 401s triggers
 * exactly one refresh.
 *
 * D82 - no body any more: the refresh token rides the
 * __Host-admin_refresh_token cookie (credentials: "include"), proven by
 * the custom X-Requested-With header RefreshCookieCsrfGuard requires.
 */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/admin/auth/refresh`, {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = await res.json();
        setSession(body.accessToken, body.sessionId);
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
  if (typeof window === "undefined") return;
  setSession(null);
  window.location.href = "/admin/login";
}

/**
 * Real session revocation (POST admin/auth/logout, added alongside this -
 * the admin terminal had no logout endpoint at all before) - best-effort:
 * a failed/offline revoke call still clears local state and redirects.
 */
async function logout() {
  if (typeof window === "undefined") return;
  await fetch(`${API_BASE}/admin/auth/logout`, {
    method: "POST",
    headers: { "X-Requested-With": "XMLHttpRequest" },
    credentials: "include",
  }).catch(() => {});
  clearSessionAndRedirectToLogin();
}

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (res.status === 401 && !isRetry && path !== "/admin/auth/refresh") {
    if (await tryRefresh()) {
      return request<T>(path, init, true);
    }
    clearSessionAndRedirectToLogin();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AdminApiError(getApiErrorMessage(body, res.statusText), res.status);
  }

  // Same fix as dashboard-api.ts's request() - a 200 with an empty body
  // (any void-returning handler, not just an explicit 204) would otherwise
  // throw SyntaxError out of res.json(), reported to callers as a generic
  // failure on an action that actually succeeded.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Same "an <a href> can't carry a Bearer header" gap dashboard-api.ts's own
 * `download()` documents - fetches the bytes with the same auth header as
 * every other admin request; the caller triggers the actual browser save
 * via a short-lived blob object URL.
 */
async function download(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: authHeaders() });
  if (!res.ok) {
    throw new AdminApiError(res.statusText, res.status);
  }
  return res.blob();
}

export const adminApi = {
  get: <T>(path: string) => request<T>(path),
  // D82 - `headers` is an escape hatch for a step-up-MFA-gated route
  // (StepUpMfaGuard reads X-Step-Up-MFA-Code), not a general-purpose
  // feature - every other existing call site keeps working unchanged
  // since the parameter is optional.
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined, headers }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  download,
  logout,
  setSession,
  getCurrentSessionId,
};
