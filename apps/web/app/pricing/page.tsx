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
  seatPrice: string | null;
  currency: string;
  billingInterval: "monthly" | "yearly" | "none";
  mostPopular?: boolean;
}

/**
 * v0.33/FR-7.19 - long, value-stacked per-tier copy the founder asked for.
 * Keyed by the live plan name from the API (never hard-coded prices/limits
 * that duplicate what plans.seed.ts already owns) - a tier renamed or
 * reordered from the admin plan editor falls back to generic copy below
 * rather than breaking.
 */
const INDIVIDUAL_TIER_COPY: Record<string, { description: string; features: string[] }> = {
  "First Month": {
    description: "Try the full Starter experience at a steep first-month discount.",
    features: [
      "Full Starter feature set, discounted for your first billing cycle",
      "Up to 100 products",
      "2% commission on sales",
      "Auto-continues onto Starter after your first month",
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
    question: "What is First Month?",
    answer:
      "First Month is your discounted entry cycle - you get the full Starter feature set at a steep first-cycle discount. At the end of your first billing cycle you continue automatically onto Starter at its regular price, with no action needed.",
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

/** SRS §5.7/FR-7.17 - tier names/prices are read entirely from /plans (the plan editor's data) - adding or reordering a tier here is a data operation, never a deploy. */
export default function PricingPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [plans, setPlans] = useState<{ individual: Plan[]; team: Plan[]; supplier: Plan[] } | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/plans`)
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
  }, [apiBase]);

  function priceLabel(plan: Plan) {
    return plan.price === "0" ? "Free" : `Rs ${plan.price}`;
  }

  function regularPriceLabel(plan: Plan) {
    if (!plan.regularPrice || Number(plan.regularPrice) <= Number(plan.price)) return undefined;
    return `Rs ${plan.regularPrice}`;
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
        </div>
      </section>

      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="For sellers" title="Individual plans" />
          {plans ? (
            <Reveal stagger={0.1} className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {plans.individual.map((plan) => {
                const copy = INDIVIDUAL_TIER_COPY[plan.name] ?? DEFAULT_INDIVIDUAL_COPY;
                return (
                  <PricingCard
                    key={plan.id}
                    name={plan.name}
                    priceLabel={priceLabel(plan)}
                    regularPriceLabel={regularPriceLabel(plan)}
                    cadence={plan.price === "0" ? undefined : plan.billingInterval === "yearly" ? "year" : "month"}
                    description={copy.description}
                    features={copy.features}
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
                  priceLabel={priceLabel(plan)}
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
