"use client";

/**
 * One shared fetch wrapper for every seller-dashboard screen (Module 10) -
 * consistent auth-header attachment and error shape, so a screen author
 * never hand-rolls `localStorage.getItem("accessToken")` + header plumbing
 * again (that repeated-by-hand pattern is what Modules 2/5/7's bare
 * functional pages did, and is exactly the inconsistency this module
 * exists to remove - SRS FR-28.3).
 */

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    const message =
      typeof body.message === "string" ? body.message : Array.isArray(body.message) ? body.message.join(", ") : res.statusText;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
