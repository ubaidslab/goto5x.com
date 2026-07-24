"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/careers", label: "Careers" },
];

/**
 * Transparent-over-hero, shrinks + glass-blurs once the page scrolls past
 * the hero band. Plain scroll-position state rather than a GSAP
 * ScrollTrigger - this is a binary "past threshold" toggle read every
 * frame via a passive listener, not an eased/scrubbed animation, so CSS
 * transitions on the existing motion tokens do the actual easing.
 */
export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 96);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-smooth",
        scrolled ? "py-3" : "py-6",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between rounded-full px-6 transition-smooth",
          scrolled ? "border border-border bg-surface/80 py-2.5 shadow-sm backdrop-blur-md" : "border border-transparent bg-transparent py-1",
        )}
      >
        <Link href="/" className="font-display text-h4 font-bold tracking-tight text-ink">
          eyosto
        </Link>
        <nav className="hidden items-center gap-6 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-muted transition-smooth-fast hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-ink-muted transition-smooth-fast hover:text-ink"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent shadow-xs transition-smooth-fast hover:bg-accent-hover active:scale-[0.98] active:bg-accent-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
