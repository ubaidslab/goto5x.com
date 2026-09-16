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
 * SRS FR-8.20 (Module 99, founder batch B17) - support.uzeyn.com is the
 * platform's first-ever SECOND platform-owned subdomain (previously this
 * was a strict binary: the one platform host, or a tenant storefront).
 * Recognized the same way as the platform host, but rewritten to its own
 * /support-center route group rather than served as-authored - a seller
 * visiting it should never see the dashboard/marketing route tree, and it
 * must not fall through to the storefront rewrite either (that would
 * resolve it as a tenant hostname lookup and 404, since no such store
 * exists).
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

const SUPPORT_CENTER_HOSTS = (process.env.SUPPORT_CENTER_HOSTNAMES ?? "support.localhost:3000,support.localhost")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

/**
 * Founder walkthrough finding (pre-Milestone-A, Phase 1 item 7) - `/admin`
 * was a predictable, guessable path with nothing standing in front of it
 * but the login form itself (real auth, unaffected either way - this is a
 * defense-in-depth layer on top of it, not a replacement). Gated behind a
 * secret entry path, rotatable via env vars alone (ADMIN_ENTRY_SECRET_PATH,
 * ADMIN_GATE_SIGNING_SECRET - see docs/launch-runbook.md for the exact
 * rotation steps), no redeploy required - only a restart to pick up the
 * new env values.
 *
 * Mechanism: visiting `/<ADMIN_ENTRY_SECRET_PATH>` sets an httpOnly,
 * signed cookie (HMAC-SHA256 over an expiry timestamp, verified with Web
 * Crypto so this runs in the Edge middleware runtime) and redirects to
 * `/admin`; every `/admin*` request without a validly-signed, unexpired
 * cookie gets a bare 404 - indistinguishable from the route not existing
 * at all, so a direct guess at `/admin` reveals nothing. Every existing
 * admin page's internal `<Link href="/admin/...">` keeps working
 * unmodified once the cookie is set, since the gate is cookie-based, not
 * a URL-rewrite the app's own links would need to know about.
 * Deliberately falls through to today's unguarded behavior when either
 * env var is unset (local dev, and any environment that hasn't
 * configured this yet) - never a hard requirement that could lock
 * everyone out of an environment that never set it up.
 */
const ADMIN_ENTRY_SECRET_PATH = process.env.ADMIN_ENTRY_SECRET_PATH;
const ADMIN_GATE_SIGNING_SECRET = process.env.ADMIN_GATE_SIGNING_SECRET;
const ADMIN_GATE_COOKIE = "admin_gate";
const ADMIN_GATE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function computeAdminGateValue(expiresAt: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ADMIN_GATE_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(expiresAt)));
  return `${expiresAt}.${toBase64Url(signature)}`;
}

async function isValidAdminGateCookie(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const [expiresAtRaw] = cookieValue.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() / 1000 > expiresAt) return false;
  return (await computeAdminGateValue(expiresAt)) === cookieValue;
}

async function handlePlatformHostRequest(request: NextRequest): Promise<NextResponse> {
  if (!ADMIN_ENTRY_SECRET_PATH || !ADMIN_GATE_SIGNING_SECRET) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;

  if (path === `/${ADMIN_ENTRY_SECRET_PATH}`) {
    const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_GATE_TTL_SECONDS;
    const response = NextResponse.redirect(new URL("/admin", request.url));
    response.cookies.set(ADMIN_GATE_COOKIE, await computeAdminGateValue(expiresAt), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_GATE_TTL_SECONDS,
    });
    return response;
  }

  if (path === "/admin" || path.startsWith("/admin/")) {
    const valid = await isValidAdminGateCookie(request.cookies.get(ADMIN_GATE_COOKIE)?.value);
    if (!valid) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (PLATFORM_HOSTS.includes(host)) {
    return handlePlatformHostRequest(request);
  }
  const url = request.nextUrl.clone();
  if (SUPPORT_CENTER_HOSTS.includes(host)) {
    url.pathname = `/support-center${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }
  url.pathname = `/storefront${request.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|sitemap.xml|robots.txt|storefront|support-center|marketing).*)"],
};
