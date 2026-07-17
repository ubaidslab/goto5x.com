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
  matcher: ["/((?!_next|favicon.ico|sitemap.xml|robots.txt|storefront).*)"],
};
