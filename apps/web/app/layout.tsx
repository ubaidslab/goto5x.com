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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${alegreyaSC.variable} ${GeistSans.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
