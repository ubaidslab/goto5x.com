"use client";

import { useEffect, useState } from "react";

type PlanGroup = "individual" | "team" | "supplier";

interface Plan {
  id: string;
  name: string;
  planGroup: PlanGroup;
  tierOrder: number;
  price: string;
  seatPrice: string | null;
  currency: string;
  billingInterval: "monthly" | "yearly" | "none";
  isActive: boolean;
}

const GROUPS: PlanGroup[] = ["individual", "team", "supplier"];

/**
 * SRS §5.7/FR-7.17 (plan groups/tiers as data) + FR-8.2 (plan CRUD),
 * scoped to what Module 14 needs - the rest of FR-8.2's admin terminal is
 * Module 17's job. Bare functional view (no design pass yet), same
 * precedent as /admin/sellers.
 */
export default function AdminPlansPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [plans, setPlans] = useState<{ individual: Plan[]; team: Plan[]; supplier: Plan[] } | null>(null);
  const [planGroup, setPlanGroup] = useState<PlanGroup>("individual");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [seatPrice, setSeatPrice] = useState("");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly" | "none">("monthly");

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}` };
  }

  function load() {
    fetch(`${apiBase}/admin/plans?includeInactive=true`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
  }

  useEffect(load, [apiBase]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${apiBase}/admin/plans`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        planGroup,
        price: Number(price),
        seatPrice: planGroup === "team" && seatPrice ? Number(seatPrice) : undefined,
        billingInterval,
      }),
    });
    setName("");
    setPrice("0");
    setSeatPrice("");
    load();
  }

  async function retire(planId: string) {
    await fetch(`${apiBase}/admin/plans/${planId}/retire`, { method: "POST", headers: authHeaders() });
    load();
  }

  return (
    <main>
      <h1>Plans - groups &amp; tiers (bare view - no design pass yet)</h1>
      <p>Define the pricing tiers sellers, teams, and suppliers can subscribe to, and retire old ones.</p>

      {GROUPS.map((group) => (
        <div key={group}>
          <h2>{group}</h2>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>Tier order</th>
                <th>Name</th>
                <th>Price</th>
                <th>Seat price</th>
                <th>Billing interval</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans?.[group].map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.tierOrder}</td>
                  <td>{plan.name}</td>
                  <td>
                    {plan.currency} {plan.price}
                  </td>
                  <td>{plan.seatPrice ? `${plan.currency} ${plan.seatPrice}/seat` : "-"}</td>
                  <td>{plan.billingInterval}</td>
                  <td>{plan.isActive ? "yes" : "no (retired)"}</td>
                  <td>
                    {plan.isActive && <button onClick={() => retire(plan.id)}>Retire</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h2>Create a new tier</h2>
      <form onSubmit={createPlan}>
        <p>
          <label>
            Group:{" "}
            <select value={planGroup} onChange={(e) => setPlanGroup(e.target.value as PlanGroup)}>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Name: <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            {planGroup === "team" ? "Leader's own price" : "Price"}:{" "}
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} required />
          </label>
        </p>
        {planGroup === "team" && (
          <p>
            <label>
              Seat price (per sponsored member/month):{" "}
              <input type="number" min={0} value={seatPrice} onChange={(e) => setSeatPrice(e.target.value)} />
            </label>
          </p>
        )}
        <p>
          <label>
            Billing interval:{" "}
            <select value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as typeof billingInterval)}>
              <option value="none">none (Free)</option>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          </label>
        </p>
        <button type="submit">Create tier</button>
      </form>
    </main>
  );
}
