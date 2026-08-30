"use client";

import { LayoutDashboard, LifeBuoy, Megaphone, Palette, ShieldCheck, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { FAQAccordion } from "@/components/marketing/FAQAccordion";
import { FeatureCatalogCard } from "@/components/marketing/FeatureCatalogCard";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { PricingCard } from "@/components/marketing/PricingCard";
import { SectionTitle } from "@/components/marketing/SectionTitle";
import { Reveal } from "@/components/motion/Reveal";
import { planTierCopy } from "@/lib/plan-tier-copy";

interface Plan {
  id: string;
  name: string;
  price: string;
  regularPrice: string | null;
  campaignPrice: string | null;
  campaignActive: boolean;
  activePrice: number;
  sixMonthPrice: number | null;
  yearlyPrice: number | null;
  seatPrice: string | null;
  currency: string;
  billingInterval: "monthly" | "yearly" | "none" | "six_month";
  mostPopular?: boolean;
}

interface PricingCopy {
  benefits: string[];
  shopifyComparison: string;
  sixMonthMultiplier: number;
  yearlyMultiplier: number;
  /** New (v0.41, founder request) - "pause new subscriptions" mode. */
  newSubscriptionsPaused: boolean;
  newSubscriptionsPausedMessage: string;
}

type Cycle = "monthly" | "six_month" | "yearly";

const FAQS = [
  {
    question: "Is there a setup fee?",
    answer: "No. Every plan below is the full price - no onboarding fee, no hidden line items.",
  },
  {
    question: "What happens on my first billing cycle?",
    answer:
      "Every tier has the same one-time first-cycle discount off its standing price, paid in a single payment at signup and verified by our team. Every cycle after that bills at the tier's standing price - there's no forced transition to a different tier.",
  },
  {
    question: "Can I change plans later?",
    answer: "Yes, anytime from your dashboard's Plans & Billing page. A plan change is applied at your next billing cycle.",
  },
  {
    question: "What does a team plan add?",
    answer: "Per-seat pricing for teammates you invite to help run your store, on top of your base plan fee.",
  },
  {
    question: "I'm a supplier, not a seller - is there a plan for me?",
    answer: "Yes - supplier plans below are for businesses that fulfill orders on behalf of sellers, not for running your own storefront.",
  },
];

const CYCLE_LABELS: Record<Cycle, string> = { monthly: "Monthly", six_month: "6 months", yearly: "Yearly" };

/**
 * Module 80 (SRS §5.6j, FR-7.24) - "every existing feature... grouped into
 * readable sections." A curated, representative list (not literally every
 * Settings key) - each line names a real, shipped mechanism, never an
 * aspirational one. Per-tier availability lives on the plan cards above;
 * this section's job is breadth, not a second gate-by-gate breakdown.
 */
const FEATURE_CATALOG: { icon: typeof ShoppingBag; title: string; items: string[] }[] = [
  {
    icon: ShoppingBag,
    title: "Selling",
    items: [
      "Storefront builder - live in minutes, no code",
      "Connect a local supplier and sell without holding stock",
      "Multi-store - run more than one storefront from one account",
      "Gift cards, both seller-issued and buyer-purchased",
      "A real returns & refunds workflow, not an inbox thread",
      "Bulk product and order tools built for real catalogs",
      "Delivery-time badges that set real buyer expectations",
    ],
  },
  {
    icon: Palette,
    title: "Design",
    items: [
      "Four structurally distinct premium themes - not one layout, new colors",
      "D-Studio: a real coded-theme escape hatch, not a locked builder",
      "Free custom domain connection, TLS handled automatically",
      "Storefront merchandising & discovery controls",
      "Remove the “Managed by UZEYN” storefront mark",
      "Product reviews with photos and video",
    ],
  },
  {
    icon: Megaphone,
    title: "Marketing",
    items: [
      "Email campaigns to your own customer list",
      "Customer segments - target by spend, order count, or location",
      "Facebook/Instagram Shop feed + WhatsApp catalog links",
      "Advanced, per-store SEO control",
      "Referral programs - Commerce Students Support & Certified Ambassador",
      "WhatsApp seller tools",
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Operations",
    items: [
      "Real-time profit & loss - not a spreadsheet you build yourself",
      "Analytics that reflect confirmed orders, never inflated by pending ones",
      "Staff accounts with role-based permissions",
      "Teams - sponsor teammates on a shared plan",
      "One-click full data export",
      "Custom invoice & receipt branding",
      "Orders Command Center - every order that needs attention, one screen",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Trust & Security",
    items: [
      "Order verification - email always free, WhatsApp and prepaid-advance from RUN",
      "Verified Store badge - an earned signal, not a marketing badge",
      "A public store health score",
      "Every listing moderated before it goes live",
      "CNIC-backed seller identity checks",
      "Account security - device limits and login alerts",
    ],
  },
  {
    icon: LifeBuoy,
    title: "Support",
    items: [
      "A guided onboarding wizard for your first store",
      "Email support on every tier, priority support on FLY",
      "A custom @support.uzeyn.com email address (FLY)",
      "Every payment verification reviewed by a real person",
    ],
  },
];

/** SRS §5.7/FR-7.17 - tier names/prices are read entirely from /plans (the plan editor's data) - adding or reordering a tier here is a data operation, never a deploy. */
export default function PricingPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [plans, setPlans] = useState<{ individual: Plan[]; team: Plan[]; supplier: Plan[] } | null>(null);
  const [copy, setCopy] = useState<PricingCopy | null>(null);
  const [cycle, setCycle] = useState<Cycle>("monthly");

  useEffect(() => {
    fetch(`${apiBase}/plans`)
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
    fetch(`${apiBase}/plans/pricing-copy`)
      .then((r) => r.json())
      .then(setCopy)
      .catch(() => {});
  }, [apiBase]);

  function cyclePriceFor(plan: Plan): number {
    if (cycle === "six_month") return plan.sixMonthPrice ?? plan.activePrice;
    if (cycle === "yearly") return plan.yearlyPrice ?? plan.activePrice;
    return plan.activePrice;
  }

  function priceLabel(plan: Plan) {
    const value = cyclePriceFor(plan);
    return value === 0 ? "Free" : `Rs ${value.toLocaleString()}`;
  }

  function regularPriceLabel(plan: Plan) {
    if (!plan.regularPrice || Number(plan.regularPrice) <= plan.activePrice) return undefined;
    if (cycle !== "monthly") return undefined; // the struck-through reference is only meaningful against the monthly figure
    return `Rs ${Number(plan.regularPrice).toLocaleString()}`;
  }

  function savingsLabel(plan: Plan): string | undefined {
    if (cycle === "monthly" || !copy) return undefined;
    const multiplier = cycle === "six_month" ? copy.sixMonthMultiplier : copy.yearlyMultiplier;
    const months = cycle === "six_month" ? 6 : 12;
    const cyclePrice = cyclePriceFor(plan);
    const payingMonthlyTotal = plan.activePrice * months;
    const saved = payingMonthlyTotal - cyclePrice;
    if (saved <= 0) return undefined;
    const effectiveMonthly = Math.round(cyclePrice / months);
    return `Rs ${effectiveMonthly.toLocaleString()}/mo effective - save Rs ${saved.toLocaleString()} vs. paying monthly ${months} times (${multiplier}x total)`;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <MarketingNav />

      <section className="pb-24 pt-40 sm:pt-48">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <p className="text-eyebrow uppercase text-accent">Pricing</p>
            <h1 className="mt-6 font-display text-display text-ink">One flat fee.</h1>
            <p className="mt-6 text-body-lg text-ink-muted">
              No setup fees, no surprise line items - live pricing, pulled straight from our plan
              catalog.
            </p>
          </Reveal>

          {copy?.newSubscriptionsPaused && (
            <Reveal delay={0.02}>
              <div className="mt-8 rounded-lg border border-border-strong bg-surface px-6 py-4 text-sm text-ink">
                {copy.newSubscriptionsPausedMessage}
              </div>
            </Reveal>
          )}

          {copy && (
            <Reveal delay={0.05} className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-ink-muted">
              {copy.benefits.map((benefit) => (
                <span key={benefit} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {benefit}
                </span>
              ))}
            </Reveal>
          )}

          <Reveal delay={0.1} className="mt-10 inline-flex rounded-full border border-border bg-surface p-1">
            {(["monthly", "six_month", "yearly"] as Cycle[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  cycle === c ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
                }`}
              >
                {CYCLE_LABELS[c]}
              </button>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="For sellers" title="Individual plans" />
          {plans ? (
            <Reveal stagger={0.1} className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {plans.individual.map((plan) => {
                const copyForTier = planTierCopy(plan.name);
                const savings = savingsLabel(plan);
                return (
                  <PricingCard
                    key={plan.id}
                    name={plan.name}
                    priceLabel={priceLabel(plan)}
                    regularPriceLabel={regularPriceLabel(plan)}
                    cadence={cyclePriceFor(plan) === 0 ? undefined : CYCLE_LABELS[cycle].toLowerCase()}
                    description={copyForTier.description + (savings ? ` ${savings}` : "")}
                    features={copyForTier.features}
                    featured={plan.mostPopular}
                  />
                );
              })}
            </Reveal>
          ) : (
            <p className="mt-16 text-center text-sm text-ink-faint">Loading live pricing…</p>
          )}
          <Reveal delay={0.15} className="mt-16 text-center">
            <p className="text-body text-ink-muted">
              Every UZEYN plan undercuts Shopify's equivalent tier - no forced app fees, no 2.9%+30¢
              payment-processor markup, and 0% commission on every sale, on every tier.
            </p>
            {copy?.shopifyComparison && <p className="mt-2 text-sm text-ink-faint">{copy.shopifyComparison}</p>}
          </Reveal>
        </div>
      </section>

      {plans && plans.team.length > 0 && (
        <section className="border-t border-border py-24">
          <div className="mx-auto max-w-6xl px-6">
            <SectionTitle eyebrow="For teams" title="Team plans" description="A base plan fee plus per-seat pricing for teammates you invite." />
            <Reveal stagger={0.1} className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {plans.team.map((plan) => (
                <PricingCard
                  key={plan.id}
                  name={plan.name}
                  priceLabel={`Rs ${plan.seatPrice}`}
                  cadence={`seat/${plan.billingInterval === "yearly" ? "year" : "month"}`}
                  description="Per teammate, on top of your base plan."
                  features={["Everything in Individual", "Role-based permissions", "Shared wallet & payouts"]}
                />
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {plans && plans.supplier.length > 0 && (
        <section className="border-t border-border py-24">
          <div className="mx-auto max-w-6xl px-6">
            <SectionTitle eyebrow="For suppliers" title="Supplier plans" description="For businesses fulfilling orders on behalf of sellers." />
            <Reveal stagger={0.1} className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {plans.supplier.map((plan) => (
                <PricingCard
                  key={plan.id}
                  name={plan.name}
                  priceLabel={plan.price === "0" ? "Free" : `Rs ${plan.price}`}
                  cadence={plan.price === "0" ? undefined : plan.billingInterval === "yearly" ? "year" : "month"}
                  description="Aggregated order dashboard across every seller you fulfill for."
                  features={["Aggregated order dashboard", "Wallet & payouts", "Email support"]}
                />
              ))}
            </Reveal>
          </div>
        </section>
      )}

      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle
            eyebrow="Everything included"
            title="Every feature, not a locked-away add-on."
            description="What you actually get, grouped the way you'll use it - not buried in a comparison table."
          />
          <Reveal stagger={0.1} className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CATALOG.map((category) => (
              <FeatureCatalogCard key={category.title} icon={category.icon} title={category.title} items={category.items} />
            ))}
          </Reveal>
        </div>
      </section>

      <section className="border-t border-border py-32">
        <div className="mx-auto max-w-3xl px-6">
          <SectionTitle eyebrow="Questions" title="Frequently asked." />
          <Reveal delay={0.1} className="mt-16">
            <FAQAccordion items={FAQS} />
          </Reveal>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
