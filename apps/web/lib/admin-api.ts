/**
 * Module 25 (Admin Completion) - one shared fetch wrapper for the admin
 * pages, mirroring `dashboard-api.ts`'s pattern for the seller dashboard.
 * Every admin page before this module hand-rolled its own
 * `localStorage.getItem("adminAccessToken")` + header plumbing (the same
 * inconsistency `dashboard-api.ts`'s own header documents for the seller
 * side) - this removes that duplication for every NEW admin page this
 * module adds. Existing admin pages are left as-is (out of this module's
 * scope to refactor 12 already-shipped, already-tested pages).
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

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("adminAccessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
 */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const sessionId = window.localStorage.getItem("adminSessionId");
  const refreshToken = window.localStorage.getItem("adminRefreshToken");
  if (!sessionId || !refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/admin/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = await res.json();
        window.localStorage.setItem("adminAccessToken", body.accessToken);
        window.localStorage.setItem("adminSessionId", body.sessionId);
        window.localStorage.setItem("adminRefreshToken", body.refreshToken);
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
  window.localStorage.removeItem("adminAccessToken");
  window.localStorage.removeItem("adminSessionId");
  window.localStorage.removeItem("adminRefreshToken");
  window.location.href = "/admin/login";
}

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
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
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new AdminApiError(res.statusText, res.status);
  }
  return res.blob();
}

export const adminApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  download,
};
