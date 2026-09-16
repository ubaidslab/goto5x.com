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
    ];
  },
};

module.exports = nextConfig;
