import { NextRequest, NextResponse } from "next/server";

/**
 * apps/web serves both the platform's own site and every tenant storefront
 * (a free `<slug>.<root domain>` subdomain, or a seller's verified custom
 * domain) from this one deployment - Traefik routes all of them here
 * (docker-compose.yml), differentiated only by the incoming Host header.
 * Any hostname that isn't explicitly the platform's own is a storefront
 * request, rewritten under /storefront - the page itself resolves which
 * store to render via the API's hostname-resolution endpoint (Module 3/4).
 *
 * `/sitemap.xml` and `/robots.txt` are excluded from the matcher below -
 * app/sitemap.ts and app/robots.ts read the Host header directly
 * themselves (see their own comments), for both the platform host and
 * every tenant host, so they must not be rewritten under /storefront.
 *
 * `/marketing` is also excluded - it's `public/marketing/`, the
 * platform's own static asset directory (screenshots/graphics used by
 * the marketing site), never tenant content. It must stay excluded for a
 * second reason too: `next/image`'s built-in optimizer re-enters the
 * whole request pipeline internally (`fetchInternalImage` in
 * next/dist/server/image-optimizer.js mocks a request through this same
 * middleware) to fetch the source file - without this exclusion, that
 * internal re-entrant request gets rewritten to
 * `/storefront/marketing/...`, 404s, and every `next/image` on a
 * `/marketing/*` asset breaks with "isn't a valid image" (found while
 * building the Phase 2 marketing homepage).
 */
const PLATFORM_HOSTS = (process.env.PLATFORM_HOSTNAMES ?? "localhost:3000,app.localhost:3000,app.localhost")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (PLATFORM_HOSTS.includes(host)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = `/storefront${request.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|sitemap.xml|robots.txt|storefront|marketing).*)"],
};
