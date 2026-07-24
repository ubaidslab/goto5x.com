"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal } from "@/components/motion/Reveal";

const ctaPrimary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 text-base font-medium text-on-accent shadow-xs " +
  "transition-smooth-fast hover:bg-accent-hover active:scale-[0.98] active:bg-accent-active " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const ctaSecondary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 text-base font-medium text-ink shadow-xs " +
  "transition-smooth-fast hover:border-border-strong hover:bg-canvas active:scale-[0.98] active:bg-border/40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const ctaPrimarySm =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent shadow-xs " +
  "transition-smooth-fast hover:bg-accent-hover active:scale-[0.98] active:bg-accent-active " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/**
 * Real proof page (Phase 1 redo, per founder: "a design system can't be
 * judged from swatches - the hero is the taste test"). Hero section only;
 * the rest of the marketing homepage is later-phase work.
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <span className="font-display text-h4 font-bold tracking-tight text-ink">eyosto</span>
        <nav className="flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-medium text-ink-muted transition-smooth-fast hover:text-ink">
            Pricing
          </Link>
          <Link href="/login" className="text-sm font-medium text-ink-muted transition-smooth-fast hover:text-ink">
            Log in
          </Link>
          <Link href="/signup" className={ctaPrimarySm}>
            Sign up
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-88px)] max-w-6xl flex-col justify-center px-6 pb-24">
        <Reveal stagger={0.12}>
          <p className="text-eyebrow uppercase text-accent">The all-in-one commerce platform</p>
          <h1 className="mt-6 font-display text-display text-ink">
            Sell more,
            <br />
            worry less.
          </h1>
        </Reveal>

        <Reveal delay={0.35}>
          <p className="mt-8 max-w-xl text-body-lg text-ink-muted">
            One platform for your store, your suppliers, and your payouts — built for Pakistan&apos;s
            sellers, from your first sale to your thousandth.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Magnetic>
              <Link href="/signup" className={ctaPrimary}>
                Start selling <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
            <Link href="/pricing" className={ctaSecondary}>
              View pricing
            </Link>
          </div>
        </Reveal>
      </main>

      {/*
        Not a Reveal here: ScrollTrigger can't resolve a meaningful "enter
        viewport" position for a `fixed` element on a page that doesn't
        scroll, so it stays stuck at opacity:0 forever. A plain CSS
        fade-in (respecting prefers-reduced-motion via motion-reduce:)
        is the correct tool for a persistent affordance like this.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-8 flex animate-[fade-in_0.8s_ease-out_0.6s_both] justify-center motion-reduce:animate-none">
        <div className="flex flex-col items-center gap-2 text-ink-faint">
          <span className="text-xs">Scroll</span>
          <span className="h-8 w-px animate-pulse bg-border-strong motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
