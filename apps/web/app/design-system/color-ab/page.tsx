"use client";

import { ArrowRight, Blocks, ShieldCheck, Truck } from "lucide-react";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { DotGrid, GradientMesh } from "@/components/marketing/AbstractGraphic";
import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal } from "@/components/motion/Reveal";

const Hero3D = dynamic(() => import("@/components/marketing/Hero3D"), { ssr: false }) as ComponentType<{
  accentHex?: string;
}>;

const ctaClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 text-base font-medium text-on-accent shadow-xs " +
  "transition-smooth-fast hover:bg-accent-hover active:scale-[0.98] active:bg-accent-active " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const VALUES = [
  { icon: Blocks, title: "Storefront, built in minutes", description: "Pick a theme, add products, publish - no developer required." },
  { icon: Truck, title: "Suppliers built in", description: "Printify or your own supplier links, fulfillment without a warehouse." },
  { icon: ShieldCheck, title: "One flat fee", description: "No setup cost, no surprise line items on your wallet." },
];

/**
 * Founder-requested Phase 2 checkpoint deliverable: a color A/B comparison
 * of the hero + one more section, monochrome default vs. a warmer "energy"
 * alternate (globals.css's [data-marketing-theme="energy"] block). Not
 * linked from the marketing nav/footer and not a shipped page - purely a
 * side-by-side screenshot surface for the founder's review. The default
 * homepage/pricing/about/careers pages are untouched by this file.
 */
export default function ColorAbPreviewPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <ComparisonBlock label="Default — monochrome + restrained accent" accentHex="#0071e3" />
      <div className="h-2 bg-ink" />
      <div data-marketing-theme="energy">
        <ComparisonBlock label="Alternate — energy" accentHex="#ff4d1c" />
      </div>
    </div>
  );
}

function ComparisonBlock({ label, accentHex }: { label: string; accentHex: string }) {
  return (
    <div className="bg-canvas">
      <div className="border-b border-border bg-surface px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </div>

      <section className="relative overflow-hidden py-24 sm:py-32">
        <GradientMesh className="pointer-events-none absolute inset-0 h-full w-full" />
        <DotGrid className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />
        <Hero3D accentHex={accentHex} />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <Reveal stagger={0.12}>
            <p className="text-eyebrow uppercase text-accent">The all-in-one commerce platform</p>
            <h1 className="mt-6 font-display text-display text-ink">
              Sell everywhere, run it from one place.
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 text-body-lg text-ink-muted">
              Storefront, suppliers, payments, and growth tools that already know how the pieces
              fit - live in minutes, not weeks.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Magnetic>
                <a href="#" className={ctaClass}>
                  Start selling <ArrowRight className="h-4 w-4" />
                </a>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-eyebrow uppercase text-accent">Why sellers switch</p>
            <h2 className="mt-4 font-display text-h1 text-ink">Built for how you actually sell.</h2>
          </Reveal>
          <Reveal stagger={0.1} className="mt-16 grid gap-6 sm:grid-cols-3">
            {VALUES.map((value) => (
              <div key={value.title} className="rounded-2xl border border-border bg-surface p-8 shadow-xs">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                  <value.icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="mt-6 font-display text-h4 font-bold text-ink">{value.title}</h3>
                <p className="mt-3 text-body text-ink-muted">{value.description}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </div>
  );
}
