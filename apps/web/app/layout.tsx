import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

/**
 * Type pairing (Phase 1 redo, post founder-rejection): Plus Jakarta Sans
 * read as "friendly startup," not "premium minimal" - none of the
 * reference points (apple/linear/vercel/stripe) would ship it. Geist
 * (Vercel's own family, used on vercel.com) carries display voice instead
 * - a neo-grotesque built on classic Swiss-typography principles, legible
 * from body copy up through massive display sizes with no personality
 * tax. Inter stays the body/UI face - proven legible at 13-14px across
 * every dense dashboard table this product has shipped. Two families,
 * one job each. See /design-system/type for the side-by-side comparison
 * against the one alternative (Instrument Sans) considered and rejected.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "UZEYN",
  description: "UZEYN — the all-in-one commerce platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${GeistSans.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
