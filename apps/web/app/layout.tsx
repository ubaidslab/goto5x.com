import { Alegreya_SC, Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

/**
 * Type pairing (founder batch A3, brand-palette pass): Alegreya SC - a
 * small-caps display serif - is the founder-directed headline face
 * platform-wide, replacing Geist as --font-display's target (see
 * globals.css). Inter stays the body/UI face, unchanged - still proven
 * legible at 13-14px across every dense dashboard table this product has
 * shipped; the founder's instruction was headings only, dense text/tables
 * keep their existing font. GeistSans stays loaded (not removed) - the
 * Atelier storefront template (app/storefront/templates/atelier.tsx)
 * references --font-geist-sans directly for its own independent
 * typographic identity, a per-seller storefront choice unrelated to this
 * platform-chrome brand pass.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const alegreyaSC = Alegreya_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-alegreya-sc",
  display: "swap",
});

export const metadata = {
  title: "UZEYN",
  description: "UZEYN — the all-in-one commerce platform",
};

const CSS_VAR_RE = /^--[a-z0-9-]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Module 92 (SRS §5.68/FR-68.4) - the runtime half of admin-configurable
 * brand colors. Public/unauthenticated endpoint (works for an anonymous
 * marketing/storefront/login visitor, not just a logged-in session);
 * returns only tokens with an active override, so the common case (no
 * admin override set yet) is an empty object and this function is a no-op.
 * Re-validated here even though the API already validates on write - this
 * function's output goes straight into a <style> tag via
 * dangerouslySetInnerHTML, so a malformed or unexpected value is dropped
 * rather than trusted blindly. Never throws, never blocks the page - a
 * slow/failed/malformed response degrades to "render the static default
 * colors," the same non-blocking-degradation discipline SRS §3.11 requires
 * of Platform Event Log writes.
 */
async function getDesignTokenOverrides(): Promise<Record<string, string>> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) return {};

  try {
    const res = await fetch(`${apiBase}/design-tokens`, {
      next: { revalidate: 60 }, // mirrors SettingsService's own Redis TTL
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return {};

    const body = (await res.json()) as unknown;
    if (!body || typeof body !== "object") return {};

    const safe: Record<string, string> = {};
    for (const [cssVar, value] of Object.entries(body as Record<string, unknown>)) {
      if (CSS_VAR_RE.test(cssVar) && typeof value === "string" && HEX_RE.test(value)) {
        safe[cssVar] = value;
      }
    }
    return safe;
  } catch {
    return {};
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const overrides = await getDesignTokenOverrides();
  const overrideEntries = Object.entries(overrides);

  return (
    <html lang="en" className={`${inter.variable} ${alegreyaSC.variable} ${GeistSans.variable}`}>
      {overrideEntries.length > 0 && (
        <head>
          <style
            id="admin-design-token-overrides"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `:root{${overrideEntries.map(([k, v]) => `${k}:${v}`).join(";")}}`,
            }}
          />
        </head>
      )}
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
