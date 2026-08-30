/**
 * Founder-directed clarification (pre-Phase-3): GO/RUN/RISE/FLY are creative
 * tier names, not self-explanatory ones - every place a seller sees one of
 * these four individual-tier names, it carries a short "who this is for"
 * subtitle so the naming never costs a seller a moment of confusion about
 * which tier fits them. Scoped to the four seller-facing individual tiers
 * only - Team/Supplier plan names (e.g. "Supplier Premium") are already
 * self-explanatory and get no subtitle.
 */
export const PLAN_TIER_SUBTITLE: Record<string, string> = {
  GO: "for new sellers",
  RUN: "for growing stores",
  RISE: "for established sellers",
  FLY: "for high-volume operations",
};

export function planTierSubtitle(planName: string): string | null {
  return PLAN_TIER_SUBTITLE[planName] ?? null;
}

export interface PlanTierCopy {
  description: string;
  features: string[];
}

/**
 * Module 61 (SRS §5.7, FR-7.20/7.21) - the long, value-stacked per-tier
 * copy the founder asked for. Keyed by the live plan name from the API
 * (never hard-coded prices/limits that duplicate what plans.seed.ts
 * already owns) - a tier renamed or reordered from the admin plan editor
 * falls back to DEFAULT_PLAN_TIER_COPY rather than breaking. Single
 * source of truth for both the public /pricing page and the seller-facing
 * Plans & Billing page (founder batch A8) - previously duplicated only on
 * /pricing.
 */
export const PLAN_TIER_COPY: Record<string, PlanTierCopy> = {
  GO: {
    description: "Get your first store live at a steep first-cycle discount, on a tier you can stay on for good.",
    features: [
      "Up to 100 products",
      "Order verification (OTP/call/WhatsApp)",
      "A real discount on your first billing cycle only",
      "No forced transition to a higher tier - GO is permanent",
    ],
  },
  RUN: {
    description: "For growing sellers ready to scale past a one-person operation.",
    features: [
      "Up to 100 products",
      "Order verification (OTP/call/WhatsApp)",
      "Profit & loss dashboard",
      "Free custom domain connection",
      "All 4 storefront templates",
      "WhatsApp seller tools",
      "“Managed by UZEYN” storefront mark",
    ],
  },
  RISE: {
    description: "For established sellers running a real, multi-product operation.",
    features: [
      "Up to 500 products",
      "Order verification (OTP/call/WhatsApp)",
      "Email marketing campaigns",
      "Full D-Studio design tools",
      "Inventory management",
    ],
  },
  FLY: {
    description: "For high-volume, multi-store operations that have outgrown the basics.",
    features: [
      "Unlimited products",
      "Order verification (OTP/call/WhatsApp)",
      "@support.uzeyn.com custom email",
      "Remove the “Managed by UZEYN” mark",
      "Priority support",
      "Advanced analytics",
    ],
  },
};

export const DEFAULT_PLAN_TIER_COPY: PlanTierCopy = {
  description: "A plan for growing stores.",
  features: ["Storefront + custom domain", "Order verification", "Email support"],
};

export function planTierCopy(planName: string): PlanTierCopy {
  return PLAN_TIER_COPY[planName] ?? DEFAULT_PLAN_TIER_COPY;
}
