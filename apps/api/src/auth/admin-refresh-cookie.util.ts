import { Request, Response } from "express";

/**
 * D82 admin slice - mirrors refresh-cookie.util.ts exactly, but with its
 * own cookie name rather than sharing the seller dashboard's. The admin
 * terminal and seller dashboard are the same Next.js app on the same
 * origin (`(admin)` is a route group, not a separate host - confirmed via
 * docker-compose.yml's Traefik rules, which name only api/app/support
 * hosts), and both hit the same API origin too - so a shared
 * `__Host-refresh_token` name would let an admin who is also logged in as
 * a seller in the same browser silently clobber one session's cookie with
 * the other's. A distinct name removes the collision entirely rather than
 * relying on the two flows never running in the same browser.
 */
const COOKIE_NAME = "__Host-admin_refresh_token";
const SEPARATOR = ":";

export function setAdminRefreshCookie(res: Response, sessionId: string, refreshToken: string, maxAgeMs: number): void {
  res.cookie(COOKIE_NAME, `${sessionId}${SEPARATOR}${refreshToken}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  });
}

export function clearAdminRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
}

export function parseAdminRefreshCookie(req: Request): { sessionId: string; refreshToken: string } | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (typeof raw !== "string") return null;
  const separatorIndex = raw.indexOf(SEPARATOR);
  if (separatorIndex === -1) return null;
  const sessionId = raw.slice(0, separatorIndex);
  const refreshToken = raw.slice(separatorIndex + 1);
  if (!sessionId || !refreshToken) return null;
  return { sessionId, refreshToken };
}
