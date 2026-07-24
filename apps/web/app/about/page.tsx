"use client";

import { ArrowRight, Heart, Scale, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { SectionTitle } from "@/components/marketing/SectionTitle";
import { StatCounter } from "@/components/marketing/StatCounter";
import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal } from "@/components/motion/Reveal";

const ctaPrimary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 text-base font-medium text-on-accent shadow-xs " +
  "transition-smooth-fast hover:bg-accent-hover active:scale-[0.98] active:bg-accent-active " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const VALUES = [
  {
    icon: Scale,
    title: "You keep control",
    description: "We're a facilitation workspace, not the seller of record. Your store, your pricing, your customer relationship - always.",
  },
  {
    icon: Zap,
    title: "Fast beats fancy",
    description: "Median time from signup to a published store is minutes, not weeks. Every screen is built to get out of your way.",
  },
  {
    icon: Sparkles,
    title: "No hidden line items",
    description: "One flat plan fee. What you see on the pricing page is what gets debited from your wallet - nothing else, ever.",
  },
  {
    icon: Heart,
    title: "Built for Pakistan's sellers",
    description: "JazzCash, Easypaisa, bank transfer, and Cash on Delivery aren't afterthoughts bolted onto a Western template - they're the default.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <MarketingNav />

      <section className="pb-24 pt-40 sm:pt-48">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <p className="text-eyebrow uppercase text-accent">About</p>
            <h1 className="mt-6 font-display text-display text-ink">
              The commerce platform Pakistan&apos;s sellers deserved.
            </h1>
            <p className="mt-6 text-body-lg text-ink-muted">
              Storefronts, suppliers, payments, and growth tools that already know how the pieces
              fit - so you spend your time selling, not stitching together five different tools.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-3xl px-6">
          <SectionTitle
            eyebrow="Why we exist"
            title="Selling online in Pakistan meant assembling your own stack."
            description="A storefront builder that doesn't understand JazzCash. A supplier relationship you manage over WhatsApp. A spreadsheet standing in for a wallet. We built the platform that assumes all of that from day one, instead of treating it as a plugin."
          />
        </div>
      </section>

      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="What we believe" title="Four things we don't compromise on." />
          <Reveal stagger={0.1} className="mt-16 grid gap-6 sm:grid-cols-2">
            {VALUES.map((value) => (
              <div key={value.title} className="rounded-2xl border border-border bg-surface p-8 shadow-xs">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                  <value.icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="mt-6 font-display text-h3 font-bold text-ink">{value.title}</h3>
                <p className="mt-3 text-body text-ink-muted">{value.description}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="border-t border-border py-32">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 sm:grid-cols-4">
          <StatCounter value={4} suffix=" min" label="Median time to first publish" />
          <StatCounter value={0} suffix="%" label="Setup fees" />
          <StatCounter value={24} suffix="/7" label="Wallet + payouts visibility" />
          <StatCounter value={2} label="Built-in supplier adapters" />
        </div>
      </section>

      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <SectionTitle
            eyebrow="The team"
            title="A small team, building in the open."
            description="We're heads-down building the platform right now - team bios and photos are coming as we grow past this early stage. If you want to help build it, see our open roles below."
          />
        </div>
      </section>

      <section className="border-t border-border bg-ink py-32">
        <Reveal className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="font-display text-h1 text-canvas">Come build it with us.</h2>
          <p className="mt-5 text-body-lg text-canvas/70">
            We&apos;re hiring across engineering, operations, and growth.
          </p>
          <div className="mt-10 flex justify-center">
            <Magnetic>
              <Link href="/careers" className={ctaPrimary}>
                See open roles <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
