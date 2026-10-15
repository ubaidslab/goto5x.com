import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Request } from "express";
import { getAllowedOrigins } from "../cors-origins.util";

/**
 * D82 - guards every endpoint that reads the __Host-refresh_token cookie
 * (refresh, logout). SameSite=Lax already blocks the cookie on a genuinely
 * cross-site request, but the founder's decision is explicit: a custom
 * header PLUS an Origin/Sec-Fetch-Site check, not SameSite alone - two
 * independent layers, not one.
 *
 * `Sec-Fetch-Site` is the primary signal: browser-set, not spoofable by
 * page JS, and tells the truth regardless of whether CORS_ALLOWED_ORIGINS
 * is configured. Production runs same-origin with no CORS allowlist at
 * all (main.ts's own comment) - an `Origin`-must-be-in-the-allowlist check
 * would incorrectly reject every real request there, since modern
 * browsers send `Origin` on state-changing requests even same-origin.
 * `Origin` is only cross-checked against the allowlist as a SECONDARY
 * signal, and only when `Sec-Fetch-Site` itself is absent (an older
 * browser, or a header stripped somewhere upstream) - the one gap this
 * leaves is narrow (both signals missing at once), and the custom header
 * below still applies regardless.
 */
@Injectable()
export class RefreshCookieCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (req.headers["x-requested-with"] !== "XMLHttpRequest") {
      throw new ForbiddenException("Missing required request header.");
    }

    const secFetchSite = req.headers["sec-fetch-site"];
    if (typeof secFetchSite === "string") {
      if (secFetchSite === "cross-site") {
        throw new ForbiddenException("Cross-site request rejected.");
      }
      return true;
    }

    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.length > 0) {
      const origin = req.headers.origin;
      if (!origin || !allowedOrigins.includes(origin)) {
        throw new ForbiddenException("Request origin not allowed.");
      }
    }

    return true;
  }
}
