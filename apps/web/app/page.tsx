"use client";

import {
  ArrowRight,
  Blocks,
  Palette,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DeviceMockup } from "@/components/marketing/DeviceMockup";
import { DotGrid, GradientMesh } from "@/components/marketing/AbstractGraphic";
import { FAQAccordion } from "@/components/marketing/FAQAccordion";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { HorizontalScrollCards } from "@/components/marketing/HorizontalScrollCards";
import { ImageStack } from "@/components/marketing/ImageStack";
import { LogoStrip } from "@/components/marketing/LogoStrip";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { PricingCard } from "@/components/marketing/PricingCard";
import { SectionTitle } from "@/components/marketing/SectionTitle";
import { StatCounter } from "@/components/marketing/StatCounter";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";
import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal } from "@/components/motion/Reveal";

const Hero3D = dynamic(() => import("@/components/marketing/Hero3D"), { ssr: false });

interface Plan {
  id: string;
  name: string;
  price: string;
  currency: string;
  billingInterval: "monthly" | "yearly" | "none";
}

const ctaPrimary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 text-base font-medium text-on-accent shadow-xs " +
  "transition-smooth-fast hover:bg-accent-hover active:scale-[0.98] active:bg-accent-active " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const ctaSecondary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 text-base font-medium text-ink shadow-xs " +
  "transition-smooth-fast hover:border-border-strong hover:bg-canvas active:scale-[0.98] active:bg-border/40 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const FEATURES = [
  {
    icon: Blocks,
    title: "Your storefront, built in minutes",
    description: "Pick a theme, add products, publish. No developer, no waiting on an agency.",
  },
  {
    icon: Truck,
    title: "Suppliers built in",
    description: "Connect Printify or your own supplier links - fulfillment happens without you touching a warehouse.",
  },
  {
    icon: Wallet,
    title: "One wallet for everything",
    description: "Plan fees, team seats, and payouts all reconcile against a single prepaid balance you can see.",
  },
  {
    icon: ShieldCheck,
    title: "Trust built for buyers",
    description: "Verified Store badges and a public health score - real signals, not a marketing badge.",
  },
  {
    icon: Palette,
    title: "Premium themes, not templates",
    description: "Every theme is a real, structurally distinct design - not one layout with a new color.",
  },
];

const TESTIMONIALS = [
  { quote: "Set my store up between two feedings. It just worked.", name: "Sara Khan", role: "Founder, Northline Goods" },
  { quote: "The wallet made accounting for the first time not terrifying.", name: "Bilal Ahmed", role: "Owner, Kohsar & Co." },
  { quote: "Switched from a page-builder plugin. Never looking back.", name: "Fatima N.", role: "Founder, Meridian Goods" },
];

const FAQS = [
  {
    question: "How fast can I actually go live?",
    answer: "Most sellers publish their first store the same day - pick a theme, add your first few products, connect a payment method, and publish.",
  },
  {
    question: "Do I need my own domain?",
    answer: "No - every store gets a free UZEYN subdomain at signup. Attach your own domain whenever you're ready; we handle the TLS certificate automatically.",
  },
  {
    question: "How does pricing actually work?",
    answer: "One flat plan fee plus a small commission on what you sell - no setup fees, no surprise line items. See the pricing section above for exact numbers.",
  },
  {
    question: "Can I sell without holding any inventory?",
    answer: "Yes - connect a supplier (Printify is built in) and orders route straight to them for fulfillment.",
  },
];

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [plans, setPlans] = useState<{ individual: Plan[] } | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/plans`)
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
  }, [apiBase]);

  function priceLabel(plan: Plan) {
    return plan.price === "0" ? "Free" : `Rs ${plan.price}`;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <MarketingNav />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden pt-40 pb-24 sm:pt-48">
        <GradientMesh className="pointer-events-none absolute inset-0 h-full w-full" />
        <Hero3D />
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal stagger={0.12}>
            <p className="text-eyebrow uppercase text-accent">The all-in-one commerce platform</p>
            <h1 className="mt-6 max-w-3xl font-display text-display text-ink">
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

          <Reveal delay={0.5} className="mt-20">
            <ImageStack
              images={[
                { src: "/marketing/dashboard-products.png", alt: "Products dashboard" },
                { src: "/marketing/dashboard-orders.png", alt: "Orders dashboard" },
                { src: "/marketing/storefront-home.png", alt: "A live storefront" },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ============ SOCIAL PROOF ============ */}
      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-center text-sm font-medium text-ink-faint">Trusted by sellers building real businesses</p>
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <LogoStrip />
          </Reveal>
        </div>
      </section>

      {/* ============ PROBLEM -> SOLUTION ============ */}
      <section className="relative overflow-hidden border-t border-border py-32">
        <DotGrid className="pointer-events-none absolute inset-x-0 top-0 h-64 w-full opacity-60" />
        <div className="relative mx-auto max-w-6xl px-6">
          <SectionTitle
            eyebrow="The problem"
            title="Every other tool makes you stitch it together yourself."
            description="A storefront builder here, a supplier spreadsheet there, a separate wallet app for payouts. Each piece works - together, they don't."
          />
          <Reveal delay={0.15} className="mx-auto mt-16 max-w-3xl rounded-2xl border border-border bg-surface p-10 text-center shadow-sm">
            <p className="font-display text-h2 font-bold text-ink">
              UZEYN is the one platform that already knows how the pieces fit.
            </p>
            <p className="mt-4 text-body text-ink-muted">
              Storefront, suppliers, orders, and payouts - one login, one wallet, one dashboard.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ HORIZONTAL FEATURE CARDS ============ */}
      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="Everything included" title="Built for the way you actually sell." />
        </div>
        <div className="mt-16">
          <HorizontalScrollCards>
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
            ))}
          </HorizontalScrollCards>
        </div>
      </section>

      {/* ============ PRODUCT SHOWCASE ============ */}
      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle
            eyebrow="The real product"
            title="Not a mockup. This is the actual dashboard."
            description="Every screen below is a live screenshot of UZEYN today - the same product you'll sign into."
          />
          <Reveal stagger={0.1} className="mt-16 grid gap-8 lg:grid-cols-2">
            <DeviceMockup src="/marketing/dashboard-products.png" alt="Products dashboard" url="app.uzeyn.com/products" />
            <DeviceMockup src="/marketing/dashboard-orders.png" alt="Orders dashboard" url="app.uzeyn.com/orders" />
          </Reveal>
          <Reveal delay={0.2} className="mt-8">
            <DeviceMockup
              src="/marketing/storefront-home.png"
              alt="A live storefront"
              url="northline-goods.uzeyn.com"
              width={1200}
              height={480}
            />
          </Reveal>
        </div>
      </section>

      {/* ============ TEMPLATES TEASER ============ */}
      <section className="relative overflow-hidden border-t border-border py-32">
        <GradientMesh className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <SectionTitle
            eyebrow="Themes"
            title="Premium themes, structurally different - not a color swap."
            description="Every built-in theme is its own real layout. Pick one, customize your tokens, publish - no code required."
          />
          <Reveal delay={0.15} className="mt-12 flex flex-wrap justify-center gap-6">
            {["Editorial", "Studio", "Market", "Atelier"].map((theme) => (
              <div key={theme} className="w-56 rounded-xl border border-border bg-surface p-6 shadow-xs">
                <div className="h-32 rounded-lg bg-canvas" />
                <p className="mt-4 text-sm font-medium text-ink">{theme}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="border-t border-border py-32">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 sm:grid-cols-4">
          <StatCounter value={4} suffix=" min" label="Median time to first publish" />
          <StatCounter value={0} suffix="%" label="Setup fees" />
          <StatCounter value={24} suffix="/7" label="Wallet + payouts visibility" />
          <StatCounter value={2} label="Built-in supplier adapters" />
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="Pricing" title="One flat fee. No surprises." description="Live pricing, pulled straight from our plan catalog." />
          <Reveal stagger={0.1} className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {plans?.individual.slice(0, 3).map((plan, i) => (
              <PricingCard
                key={plan.id}
                name={plan.name}
                priceLabel={priceLabel(plan)}
                cadence={plan.price === "0" ? undefined : plan.billingInterval === "yearly" ? "year" : "month"}
                description={i === 0 ? "For getting your first store live." : i === 1 ? "For sellers ready to grow." : "For established stores."}
                features={["Unlimited products", "Storefront + custom domain", "Wallet & payouts", "Email support"]}
                featured={i === 1}
              />
            ))}
          </Reveal>
          {!plans && <p className="mt-8 text-center text-sm text-ink-faint">Loading live pricing…</p>}
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="Sellers on UZEYN" title="Placeholder stories - real ones are coming soon." />
          <Reveal stagger={0.1} className="mt-16 grid gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <TestimonialCard key={t.name} {...t} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-3xl px-6">
          <SectionTitle eyebrow="Questions" title="Frequently asked." />
          <Reveal delay={0.1} className="mt-16">
            <FAQAccordion items={FAQS} />
          </Reveal>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="border-t border-border bg-ink py-32">
        <Reveal className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="font-display text-h1 text-canvas">Ready to sell?</h2>
          <p className="mt-5 text-body-lg text-canvas/70">
            Publish your first store today - no credit card required.
          </p>
          <div className="mt-10 flex justify-center">
            <Magnetic>
              <Link href="/signup" className={ctaPrimary}>
                Start selling <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
