"use client";

/**
 * One shared fetch wrapper for every seller-dashboard screen (Module 10) -
 * consistent auth-header attachment and error shape, so a screen author
 * never hand-rolls `localStorage.getItem("accessToken")` + header plumbing
 * again (that repeated-by-hand pattern is what Modules 2/5/7's bare
 * functional pages did, and is exactly the inconsistency this module
 * exists to remove - SRS FR-28.3).
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

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Founder walkthrough finding (pre-Milestone-A, Phase 0.5) - a 15-minute
 * access token (JWT_ACCESS_TTL_MINUTES) had nothing behind it: the
 * refresh token this app already stores on login was never read back out
 * to use. Any session older than 15 minutes showed the backend's bare
 * "Unauthorized" as inline page content on the very next request, on
 * every one of the ~60 dashboard pages using this client. `refreshPromise`
 * is shared across concurrent callers so a burst of requests that all
 * 401 at once triggers exactly one refresh (POST /auth/refresh rotates
 * the refresh token, so a second concurrent call with the now-stale token
 * would itself fail).
 */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const sessionId = window.localStorage.getItem("sessionId");
  const refreshToken = window.localStorage.getItem("refreshToken");
  if (!sessionId || !refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = await res.json();
        window.localStorage.setItem("accessToken", body.accessToken);
        window.localStorage.setItem("sessionId", body.sessionId);
        window.localStorage.setItem("refreshToken", body.refreshToken);
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
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("sessionId");
  window.localStorage.removeItem("refreshToken");
  window.location.href = "/login";
}

/**
 * Real session revocation (POST /auth/logout), not just a client-side
 * token-forget - best-effort: a failed/offline revoke call still clears
 * local state and redirects, since the user's intent to leave shouldn't be
 * blocked by a network hiccup.
 */
async function logout() {
  if (typeof window === "undefined") return;
  const sessionId = window.localStorage.getItem("sessionId");
  if (sessionId) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }
  clearSessionAndRedirectToLogin();
}

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  // FormData bodies must let the browser set their own multipart boundary -
  // forcing application/json here would break upload() below.
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
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
 * this API uses throughout (no cookie auth exists), so a plain `<a href>`
 * can't hit an authenticated download route. This fetches the bytes with
 * the same auth header as every other request, then the caller triggers
 * the actual browser save via a blob object URL.
 */
async function download(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
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
};
