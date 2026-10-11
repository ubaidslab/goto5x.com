/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.API_BASE_URL ?? "http://localhost:3000",
  },
  // GHSA-2xp9-vwfh-vxw4 (dependency-audit exception, scripts/dependency-audit.sh) -
  // already confirmed unreachable here (next/image only ever renders 2
  // hardcoded local marketing assets, never remote/user-suppliable input),
  // but explicit rather than relying on Next's own default to stay true
  // regardless of any future Next version's default change - this is the
  // exact interim mitigation the official patched Next.js releases apply.
  images: {
    formats: ["image/webp"],
  },
  // Founder walkthrough finding (pre-Milestone-A, Phase 1 item 8 - confirming
  // XSS/injection coverage) - these three are safe, zero-risk-of-breakage
  // additions (verified: no <iframe> use anywhere in this app, so
  // X-Frame-Options: DENY cannot break any legitimate embed). A full
  // Content-Security-Policy is deliberately NOT added here - this app
  // renders seller-configured product images from arbitrary storage/CDN
  // domains, seller-authored custom head tags, and multiple third-party
  // widget integrations, so a CSP tight enough to matter needs its own
  // dedicated pass with real per-route testing across the storefront,
  // dashboard, and admin terminal, not a rushed addition here that risks
  // silently breaking image/embed rendering platform-wide.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // D95/B3 (2026-10-10) - a real Content-Security-Policy, but scoped
      // to ONLY the three buyer-facing pages where a payment gateway's
      // own client-side script could ever load (checkout, and the two
      // pages that render the gateway-provider picker post-checkout:
      // order-status/order-confirmation - see
      // apps/web/app/storefront/order-status/{model-advance-panel,
      // order-verification-panel}.tsx). This is NOT the full-site CSP the
      // comment above this one deliberately defers (seller-configured
      // image domains, seller-authored head tags, and third-party widget
      // integrations are genuinely not safe to lock down without a real
      // per-route audit) - these three routes are a narrow, fully
      // first-party exception: today's four gateway adapters
      // (raast/easypaisa/jazzcash/bank) are pure server-to-server HTTPS
      // calls with zero client-side script, so CHECKOUT_CSP_EXTRA_SOURCES
      // below is empty and this just locks down the real baseline. When a
      // future "soon" provider (Stripe etc., M3/1C) ships a real
      // client-side script, add its required sources here AND to its
      // entry in apps/api/src/payment-gateway/gateway-registry.ts (kept
      // as plain, independently-maintained data on each side - this repo
      // has no shared package between apps/web and apps/api to import
      // the registry from directly).
      {
        source: "/storefront/checkout",
        headers: [{ key: "Content-Security-Policy", value: buildCheckoutCsp() }],
      },
      {
        source: "/storefront/order-status/:token",
        headers: [{ key: "Content-Security-Policy", value: buildCheckoutCsp() }],
      },
      {
        source: "/storefront/order-confirmation/:token",
        headers: [{ key: "Content-Security-Policy", value: buildCheckoutCsp() }],
      },
    ];
  },
};

// Mirrors gateway-registry.ts's "soon" list conceptually, but only ever
// needs entries once a provider actually ships a client-side script -
// today that's none of them (see the comment above). Shape:
// { scriptSrc: ["https://js.stripe.com"], connectSrc: ["https://api.stripe.com"], frameSrc: [...] }
const CHECKOUT_CSP_EXTRA_SOURCES = [];

function buildCheckoutCsp() {
  const scriptSrc = ["'self'", "'unsafe-inline'", ...CHECKOUT_CSP_EXTRA_SOURCES.flatMap((s) => s.scriptSrc ?? [])];
  const connectSrc = ["'self'", ...CHECKOUT_CSP_EXTRA_SOURCES.flatMap((s) => s.connectSrc ?? [])];
  const frameSrc = ["'none'", ...CHECKOUT_CSP_EXTRA_SOURCES.flatMap((s) => s.frameSrc ?? [])];
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${frameSrc.join(" ")}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join("; ");
}

module.exports = nextConfig;
