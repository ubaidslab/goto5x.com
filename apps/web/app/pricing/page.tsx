"use client";

import { useEffect, useState } from "react";

interface Plan {
  id: string;
  name: string;
  price: string;
  seatPrice: string | null;
  currency: string;
  billingInterval: "monthly" | "yearly" | "none";
}

/**
 * SRS §5.7/FR-7.17 - tier names/prices are read entirely from /plans (the
 * plan editor's data) - adding or reordering a tier here is a data
 * operation, never a deploy. Bare functional page only (no design pass
 * yet) - the premium visual treatment is Module 19's job, same as the
 * homepage (app/page.tsx).
 */
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
    return plan.price === "0" ? "Free" : `${plan.currency} ${plan.price}/${plan.billingInterval}`;
  }

  return (
    <main>
      <h1>Pricing</h1>
      <p>Bare functional page - no design pass yet (Module 19).</p>

      <h2>Seller plans</h2>
      <ul>
        {plans?.individual.map((plan) => (
          <li key={plan.id}>
            <strong>{plan.name}</strong> - {priceLabel(plan)}
          </li>
        ))}
      </ul>

      <h2>Team plans</h2>
      <ul>
        {plans?.team.map((plan) => (
          <li key={plan.id}>
            <strong>{plan.name}</strong> - {plan.currency} {plan.seatPrice}/seat/{plan.billingInterval}
          </li>
        ))}
      </ul>

      <h2>Supplier plans</h2>
      <ul>
        {plans?.supplier.map((plan) => (
          <li key={plan.id}>
            <strong>{plan.name}</strong> - {priceLabel(plan)}
          </li>
        ))}
      </ul>
    </main>
  );
}
