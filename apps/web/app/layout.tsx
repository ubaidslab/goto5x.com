import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

/**
 * Type pairing (Phase 1 design system): Plus Jakarta Sans carries display
 * voice (headlines, hero copy, the wordmark) - a geometric sans with more
 * confidence and tighter, more considered letterforms than Inter at large
 * sizes. Inter stays the body/UI face - it's already proven at small sizes
 * across every dense dashboard table this product has shipped, so keeping
 * it (rather than replacing it site-wide) protects that legibility while
 * still giving the product a typographic identity beyond "plain Inter."
 * Two families only, per the design system's own type-pairing rule.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata = {
  title: "eyosto",
  description: "eyosto — the all-in-one commerce platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
