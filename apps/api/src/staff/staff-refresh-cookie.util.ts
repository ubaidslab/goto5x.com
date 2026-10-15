import { Request, Response } from "express";

/**
 * D82 staff slice (`docs/auth-session-design.md`'s "Staff sub-account
 * tokens" bullet) - mirrors admin-refresh-cookie.util.ts exactly, with its
 * own cookie name again: the staff login flow shares the same apps/web
 * origin and the same API origin as both the seller dashboard and the
 * admin terminal, so a shared cookie name would risk one actor type's
 * login silently clobbering another's in the same browser.
 */
const COOKIE_NAME = "__Host-staff_refresh_token";
const SEPARATOR = ":";

export function setStaffRefreshCookie(res: Response, sessionId: string, refreshToken: string, maxAgeMs: number): void {
  res.cookie(COOKIE_NAME, `${sessionId}${SEPARATOR}${refreshToken}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  });
}

export function clearStaffRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
}

export function parseStaffRefreshCookie(req: Request): { sessionId: string; refreshToken: string } | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (typeof raw !== "string") return null;
  const separatorIndex = raw.indexOf(SEPARATOR);
  if (separatorIndex === -1) return null;
  const sessionId = raw.slice(0, separatorIndex);
  const refreshToken = raw.slice(separatorIndex + 1);
  if (!sessionId || !refreshToken) return null;
  return { sessionId, refreshToken };
}
