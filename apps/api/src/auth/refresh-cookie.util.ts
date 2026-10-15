import { Request, Response } from "express";

/**
 * D82 - the refresh token (and the sessionId it pairs with) now travels as
 * one `__Host-refresh_token` cookie instead of two plaintext localStorage
 * values. `__Host-` requires Secure, Path=/, and no Domain attribute (the
 * strictest cookie-scoping option available, per the founder's own
 * wording) - this cookie is host-only to whichever exact host sets it
 * (the API's own origin), never shared across subdomains. `sessionId` and
 * `refreshToken` are packed into one cookie value (joined by `:`, neither
 * ever contains that character - both are a UUID and two concatenated
 * UUIDs respectively) rather than two separate cookies, so there's one
 * thing to set/clear/parse, not two that could drift out of sync.
 *
 * SameSite=Lax, not None: this project's dashboard/admin and API origins
 * are different subdomains of the SAME registrable domain in every real
 * topology (`app.*`/`api.*` - confirmed via docker-compose.yml's Traefik
 * host rules), which browsers treat as same-site to each other - Lax
 * already covers a same-site fetch() with credentials, and is strictly
 * tighter than the cross-site-only None the original Option A proposal
 * assumed it needed.
 */
const COOKIE_NAME = "__Host-refresh_token";
const SEPARATOR = ":";

export function setRefreshCookie(res: Response, sessionId: string, refreshToken: string, maxAgeMs: number): void {
  res.cookie(COOKIE_NAME, `${sessionId}${SEPARATOR}${refreshToken}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
}

export function parseRefreshCookie(req: Request): { sessionId: string; refreshToken: string } | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (typeof raw !== "string") return null;
  const separatorIndex = raw.indexOf(SEPARATOR);
  if (separatorIndex === -1) return null;
  const sessionId = raw.slice(0, separatorIndex);
  const refreshToken = raw.slice(separatorIndex + 1);
  if (!sessionId || !refreshToken) return null;
  return { sessionId, refreshToken };
}
