"use client";

import { useEffect, useState } from "react";
import { FAQAccordion } from "@/components/marketing/FAQAccordion";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { PricingCard } from "@/components/marketing/PricingCard";
import { SectionTitle } from "@/components/marketing/SectionTitle";
import { Reveal } from "@/components/motion/Reveal";

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
}

type Cycle = "monthly" | "six_month" | "yearly";

/**
 * Module 61 (SRS §5.7, FR-7.20/7.21) - long, value-stacked per-tier copy
 * the founder asked for. Keyed by the live plan name from the API (never
 * hard-coded prices/limits that duplicate what plans.seed.ts already
 * owns) - a tier renamed or reordered from the admin plan editor falls
 * back to generic copy below rather than breaking.
 */
const INDIVIDUAL_TIER_COPY: Record<string, { description: string; features: string[] }> = {
  Basic: {
    description: "Get your first store live at a steep first-cycle discount, on a tier you can stay on for good.",
    features: [
      "Up to 100 products",
      "2% commission on sales",
      "A real discount on your first billing cycle only",
      "No forced transition to a higher tier - Basic is permanent",
    ],
  },
  Starter: {
    description: "For getting your first store live and taking real orders.",
    features: [
      "Up to 100 products",
      "2% commission on sales",
      "Order verification (OTP/call/WhatsApp)",
      "Profit & loss dashboard",
      "Free custom domain connection",
      "All 4 storefront templates",
      "WhatsApp seller tools",
      "“Managed by UZEYN” storefront mark",
    ],
  },
  Growth: {
    description: "For sellers ready to scale past a one-person operation.",
    features: [
      "Up to 500 products",
      "1.5% commission on sales",
      "3 staff accounts",
      "Email marketing campaigns",
      "Gift cards & customer segments",
      "Facebook/Instagram Shop feed",
      "Full D-Studio design tools",
      "Inventory management",
    ],
  },
  Pro: {
    description: "For established stores that have outgrown the basics.",
    features: [
      "Unlimited products",
      "1% commission on sales - the lowest tier",
      "10 staff accounts",
      "@support.uzeyn.com custom email",
      "Remove the “Managed by UZEYN” mark",
      "Priority support",
      "Advanced analytics",
    ],
  },
};
const DEFAULT_INDIVIDUAL_COPY = { description: "A plan for growing stores.", features: ["Storefront + custom domain", "Wallet & payouts", "Email support"] };

const FAQS = [
  {
    question: "Is there a setup fee?",
    answer: "No. Every plan below is the full price - no onboarding fee, no hidden line items.",
  },
  {
    question: "What happens on my first billing cycle?",
    answer:
      "Every tier has its own one-time first-cycle discount, paid together with your minimum wallet top-up in a single combined payment at signup. Every cycle after that bills at the tier's standing price - there's no forced transition to a different tier.",
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
                const copyForTier = INDIVIDUAL_TIER_COPY[plan.name] ?? DEFAULT_INDIVIDUAL_COPY;
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
              payment-processor markup on top, and a commission rate that only goes down as you grow.
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
