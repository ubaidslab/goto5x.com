"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";

type PlanGroup = "individual" | "team" | "supplier";

interface Plan {
  id: string;
  name: string;
  planGroup: PlanGroup;
  tierOrder: number;
  price: string;
  regularPrice: string | null;
  firstCyclePrice: string | null;
  campaignPrice: string | null;
  campaignActive: boolean;
  seatPrice: string | null;
  currency: string;
  billingInterval: "monthly" | "yearly" | "none" | "six_month";
  isActive: boolean;
  mostPopular?: boolean;
  activePrice?: number;
  sixMonthPrice?: number | null;
  yearlyPrice?: number | null;
}

const GROUPS: PlanGroup[] = ["individual", "team", "supplier"];

/**
 * SRS §5.7/FR-7.17 (plan groups/tiers as data) + FR-8.2 (plan CRUD),
 * scoped to what Module 14 needs - the rest of FR-8.2's admin terminal is
 * Module 17's job. Bare functional view (no design pass yet), same
 * precedent as /admin/sellers.
 */
export default function AdminPlansPage() {
  const confirm = useConfirm();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [plans, setPlans] = useState<{ individual: Plan[]; team: Plan[]; supplier: Plan[] } | null>(null);
  const [planGroup, setPlanGroup] = useState<PlanGroup>("individual");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [regularPrice, setRegularPrice] = useState("");
  const [firstCyclePrice, setFirstCyclePrice] = useState("");
  const [campaignPrice, setCampaignPrice] = useState("");
  const [seatPrice, setSeatPrice] = useState("");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly" | "none" | "six_month">("monthly");
  const [grantSellerId, setGrantSellerId] = useState("");
  const [grantPlanId, setGrantPlanId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscountType, setPromoDiscountType] = useState<"percent" | "fixed">("percent");
  const [promoDiscountValue, setPromoDiscountValue] = useState("0");

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
        regularPrice: regularPrice ? Number(regularPrice) : undefined,
        firstCyclePrice: firstCyclePrice ? Number(firstCyclePrice) : undefined,
        campaignPrice: campaignPrice ? Number(campaignPrice) : undefined,
        seatPrice: planGroup === "team" && seatPrice ? Number(seatPrice) : undefined,
        billingInterval,
      }),
    });
    setName("");
    setPrice("0");
    setRegularPrice("");
    setFirstCyclePrice("");
    setCampaignPrice("");
    setSeatPrice("");
    load();
  }

  async function toggleCampaign(plan: Plan) {
    await fetch(`${apiBase}/admin/plans/${plan.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ campaignActive: !plan.campaignActive }),
    });
    load();
  }

  async function retire(plan: Plan) {
    const ok = await confirm({
      title: `Retire "${plan.name}" (${plan.planGroup})?`,
      description: "Retired tiers can no longer be subscribed to by new sellers. Existing subscribers are unaffected.",
      changes: [{ label: "Active", from: "yes", to: "no (retired)" }],
      confirmLabel: "Retire",
      tone: "danger",
    });
    if (!ok) return;
    await fetch(`${apiBase}/admin/plans/${plan.id}/retire`, { method: "POST", headers: authHeaders() });
    load();
  }

  async function grantPlan(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${apiBase}/admin/sellers/${grantSellerId}/plan`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ planId: grantPlanId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.message ?? "Couldn't grant this plan.");
      return;
    }
    setGrantSellerId("");
    setGrantPlanId("");
  }

  async function createPromoCode(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${apiBase}/admin/promo-codes`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        code: promoCode,
        discountType: promoDiscountType,
        discountValue: Number(promoDiscountValue),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.message ?? "Couldn't create this promo code.");
      return;
    }
    setPromoCode("");
    setPromoDiscountValue("0");
  }

  const allPlans = plans ? [...plans.individual, ...plans.team, ...plans.supplier] : [];

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
                <th>Regular price</th>
                <th>First-cycle price</th>
                <th>Campaign price</th>
                <th>Six-month</th>
                <th>Yearly</th>
                <th>Seat price</th>
                <th>Billing interval</th>
                <th>Most popular</th>
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
                  <td>{plan.regularPrice ? `${plan.currency} ${plan.regularPrice}` : "-"}</td>
                  <td>{plan.firstCyclePrice ? `${plan.currency} ${plan.firstCyclePrice}` : "-"}</td>
                  <td>
                    {plan.campaignPrice ? `${plan.currency} ${plan.campaignPrice}` : "-"}
                    {plan.campaignPrice && (
                      <>
                        {" "}
                        (<button onClick={() => toggleCampaign(plan)}>{plan.campaignActive ? "active - deactivate" : "inactive - activate"}</button>)
                      </>
                    )}
                  </td>
                  <td>{plan.sixMonthPrice != null ? `${plan.currency} ${plan.sixMonthPrice}` : "-"}</td>
                  <td>{plan.yearlyPrice != null ? `${plan.currency} ${plan.yearlyPrice}` : "-"}</td>
                  <td>{plan.seatPrice ? `${plan.currency} ${plan.seatPrice}/seat` : "-"}</td>
                  <td>{plan.billingInterval}</td>
                  <td>{plan.mostPopular ? "yes" : ""}</td>
                  <td>{plan.isActive ? "yes" : "no (retired)"}</td>
                  <td>
                    {plan.isActive && <button onClick={() => retire(plan)}>Retire</button>}
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
        <p>
          <label>
            Regular price (struck-through "was" price, optional):{" "}
            <input type="number" min={0} value={regularPrice} onChange={(e) => setRegularPrice(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            First-cycle price (one-time discount for the subscription's very first billing cycle, optional):{" "}
            <input type="number" min={0} value={firstCyclePrice} onChange={(e) => setFirstCyclePrice(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            Campaign price (a second, toggleable discount - activate/deactivate from the table above, optional):{" "}
            <input type="number" min={0} value={campaignPrice} onChange={(e) => setCampaignPrice(e.target.value)} />
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
              <option value="none">none (no recurring charge)</option>
              <option value="monthly">monthly</option>
              <option value="six_month">six-month</option>
              <option value="yearly">yearly</option>
            </select>
          </label>
        </p>
        <button type="submit">Create tier</button>
      </form>

      <h2>Grant a plan to a seller (FR-8.2)</h2>
      <p>Comp a plan directly onto a seller's subscription - bypasses billing/checkout.</p>
      <form onSubmit={grantPlan}>
        <p>
          <label>
            Seller ID: <input value={grantSellerId} onChange={(e) => setGrantSellerId(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Plan:{" "}
            <select value={grantPlanId} onChange={(e) => setGrantPlanId(e.target.value)} required>
              <option value="">Select a plan...</option>
              {allPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.planGroup})
                </option>
              ))}
            </select>
          </label>
        </p>
        <button type="submit">Grant plan</button>
      </form>

      <h2>Create a platform promo code (FR-7.9)</h2>
      <form onSubmit={createPromoCode}>
        <p>
          <label>
            Code: <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Discount type:{" "}
            <select value={promoDiscountType} onChange={(e) => setPromoDiscountType(e.target.value as typeof promoDiscountType)}>
              <option value="percent">percent off</option>
              <option value="fixed">fixed amount off</option>
            </select>
          </label>
        </p>
        <p>
          <label>
            Discount value: <input type="number" min={0} value={promoDiscountValue} onChange={(e) => setPromoDiscountValue(e.target.value)} required />
          </label>
        </p>
        <button type="submit">Create promo code</button>
      </form>
    </main>
  );
}
