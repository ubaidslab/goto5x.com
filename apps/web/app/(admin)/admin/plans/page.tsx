"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";

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
const GROUP_LABELS: Record<PlanGroup, string> = { individual: "Individual", team: "Team", supplier: "Supplier" };

/**
 * Phase 6c (Admin Terminal re-skin) - SRS §5.7/FR-7.17's plan groups/tiers
 * page + FR-8.2's plan CRUD, restyled onto DashCard. Every section/action
 * preserved: pause-new-subscriptions toggle, per-group tier tables
 * (campaign toggle, retire), create-tier form, grant-a-plan, promo codes.
 * Now uses adminApi consistently instead of hand-rolled fetch/authHeaders.
 */
export default function AdminPlansPage() {
  const confirm = useConfirm();
  const [plans, setPlans] = useState<{ individual: Plan[]; team: Plan[]; supplier: Plan[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  // New (v0.41, founder request) - "pause new subscriptions" mode. A
  // narrower, admin-controlled pause than platform-wide maintenance mode:
  // blocks only a new seller signup and a first-cycle plan-fee submission,
  // never an existing seller's renewal/dashboard/store.
  const [paused, setPaused] = useState<boolean | null>(null);
  const [pausedMessage, setPausedMessage] = useState("");
  const [pauseSaving, setPauseSaving] = useState(false);

  function load() {
    adminApi
      .get<{ individual: Plan[]; team: Plan[]; supplier: Plan[] }>("/admin/plans?includeInactive=true")
      .then(setPlans)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load plans."));
  }

  function loadPauseState() {
    adminApi
      .get<{ effectiveValue: unknown }>("/admin/settings/resolve?key=billing.new_subscriptions_paused")
      .then((d) => setPaused(Boolean(d.effectiveValue)))
      .catch(() => {});
    adminApi
      .get<{ effectiveValue: unknown }>("/admin/settings/resolve?key=billing.new_subscriptions_paused_message")
      .then((d) => setPausedMessage(String(d.effectiveValue ?? "")))
      .catch(() => {});
  }

  useEffect(load, []);
  useEffect(loadPauseState, []);

  async function savePauseState() {
    const ok = await confirm({
      title: paused ? "Pause new subscriptions?" : "Resume new subscriptions?",
      description: paused
        ? "Blocks new seller signups and any first-cycle plan-fee submission, showing the message below on the pricing page. Existing sellers are completely unaffected."
        : "Resumes normal new-seller signup and first-cycle plan-fee payment.",
      changes: [{ label: "billing.new_subscriptions_paused", from: String(!paused), to: String(paused) }],
      confirmLabel: "Save",
      tone: paused ? "danger" : "default",
    });
    if (!ok) return;
    setPauseSaving(true);
    try {
      await adminApi.put("/admin/settings/values", { key: "billing.new_subscriptions_paused", scopeType: "global", value: paused });
      await adminApi.put("/admin/settings/values", { key: "billing.new_subscriptions_paused_message", scopeType: "global", value: pausedMessage });
    } finally {
      setPauseSaving(false);
    }
  }

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi.post("/admin/plans", {
        name,
        planGroup,
        price: Number(price),
        regularPrice: regularPrice ? Number(regularPrice) : undefined,
        firstCyclePrice: firstCyclePrice ? Number(firstCyclePrice) : undefined,
        campaignPrice: campaignPrice ? Number(campaignPrice) : undefined,
        seatPrice: planGroup === "team" && seatPrice ? Number(seatPrice) : undefined,
        billingInterval,
      });
      setName("");
      setPrice("0");
      setRegularPrice("");
      setFirstCyclePrice("");
      setCampaignPrice("");
      setSeatPrice("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't create this tier.");
    }
  }

  async function toggleCampaign(plan: Plan) {
    await adminApi.patch(`/admin/plans/${plan.id}`, { campaignActive: !plan.campaignActive });
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
    await adminApi.post(`/admin/plans/${plan.id}/retire`);
    load();
  }

  async function grantPlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi.post(`/admin/sellers/${grantSellerId}/plan`, { planId: grantPlanId });
      setGrantSellerId("");
      setGrantPlanId("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't grant this plan.");
    }
  }

  async function createPromoCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi.post("/admin/promo-codes", { code: promoCode, discountType: promoDiscountType, discountValue: Number(promoDiscountValue) });
      setPromoCode("");
      setPromoDiscountValue("0");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't create this promo code.");
    }
  }

  const allPlans = plans ? [...plans.individual, ...plans.team, ...plans.supplier] : [];

  if (!plans) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Plans" description="Define the pricing tiers sellers, teams, and suppliers can subscribe to, and retire old ones." />

      {error && <Alert tone="danger">{error}</Alert>}

      <DashCard className="mb-4 max-w-xl">
        <DashCardHeader
          title="Pause new subscriptions"
          description="Blocks new seller signups and a first-cycle plan-fee submission - shown on the pricing page. Existing sellers' dashboards, stores, and renewal payments are completely unaffected. Distinct from platform-wide maintenance mode (Settings Registry), which blocks everything."
        />
        {paused === null ? (
          <PageSpinner />
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
              Paused
            </label>
            <Field label="Message shown to sellers">
              <Textarea rows={2} value={pausedMessage} onChange={(e) => setPausedMessage(e.target.value)} />
            </Field>
            <Button loading={pauseSaving} onClick={savePauseState}>
              Save
            </Button>
          </div>
        )}
      </DashCard>

      <Reveal stagger={0.08}>
      {GROUPS.map((group) => (
        <DashCard key={group} className="mb-4">
          <DashCardHeader title={GROUP_LABELS[group]} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-3">Tier</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Regular</th>
                  <th className="py-2 pr-3">First-cycle</th>
                  <th className="py-2 pr-3">Campaign</th>
                  <th className="py-2 pr-3">6-month</th>
                  <th className="py-2 pr-3">Yearly</th>
                  <th className="py-2 pr-3">Seat</th>
                  <th className="py-2 pr-3">Interval</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans[group].map((plan) => (
                  <tr key={plan.id}>
                    <td className="py-2 pr-3 tabular-nums text-ink-muted">{plan.tierOrder}</td>
                    <td className="py-2 pr-3 font-medium text-ink">
                      {plan.name} {plan.mostPopular && <Badge tone="info">popular</Badge>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-ink">
                      {plan.currency} {plan.price}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-ink-muted">{plan.regularPrice ? `${plan.currency} ${plan.regularPrice}` : "-"}</td>
                    <td className="py-2 pr-3 tabular-nums text-ink-muted">{plan.firstCyclePrice ? `${plan.currency} ${plan.firstCyclePrice}` : "-"}</td>
                    <td className="py-2 pr-3">
                      {plan.campaignPrice ? (
                        <span className="flex items-center gap-1.5 tabular-nums text-ink-muted">
                          {plan.currency} {plan.campaignPrice}
                          <Button variant="ghost" size="sm" onClick={() => toggleCampaign(plan)}>
                            {plan.campaignActive ? "deactivate" : "activate"}
                          </Button>
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-ink-muted">{plan.sixMonthPrice != null ? `${plan.currency} ${plan.sixMonthPrice}` : "-"}</td>
                    <td className="py-2 pr-3 tabular-nums text-ink-muted">{plan.yearlyPrice != null ? `${plan.currency} ${plan.yearlyPrice}` : "-"}</td>
                    <td className="py-2 pr-3 tabular-nums text-ink-muted">{plan.seatPrice ? `${plan.currency} ${plan.seatPrice}/seat` : "-"}</td>
                    <td className="py-2 pr-3 text-ink-muted">{plan.billingInterval}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={plan.isActive ? "success" : "neutral"}>{plan.isActive ? "active" : "retired"}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {plan.isActive && (
                        <Button variant="ghost" size="sm" onClick={() => retire(plan)}>
                          Retire
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashCard>
      ))}
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashCard>
          <DashCardHeader title="Create a new tier" />
          <form onSubmit={createPlan} className="space-y-3">
            <Field label="Group">
              <Select value={planGroup} onChange={(e) => setPlanGroup(e.target.value as PlanGroup)}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label={planGroup === "team" ? "Leader's own price" : "Price"}>
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} required />
            </Field>
            <Field label="Regular price (struck-through 'was' price, optional)">
              <Input type="number" min={0} value={regularPrice} onChange={(e) => setRegularPrice(e.target.value)} />
            </Field>
            <Field label="First-cycle price (one-time discount for the very first billing cycle, optional)">
              <Input type="number" min={0} value={firstCyclePrice} onChange={(e) => setFirstCyclePrice(e.target.value)} />
            </Field>
            <Field label="Campaign price (a second, toggleable discount - activate/deactivate from the table above, optional)">
              <Input type="number" min={0} value={campaignPrice} onChange={(e) => setCampaignPrice(e.target.value)} />
            </Field>
            {planGroup === "team" && (
              <Field label="Seat price (per sponsored member/month)">
                <Input type="number" min={0} value={seatPrice} onChange={(e) => setSeatPrice(e.target.value)} />
              </Field>
            )}
            <Field label="Billing interval">
              <Select value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as typeof billingInterval)}>
                <option value="none">none (no recurring charge)</option>
                <option value="monthly">monthly</option>
                <option value="six_month">six-month</option>
                <option value="yearly">yearly</option>
              </Select>
            </Field>
            <Button type="submit">Create tier</Button>
          </form>
        </DashCard>

        <div className="space-y-4">
          <DashCard>
            <DashCardHeader title="Grant a plan to a seller" description="Comp a plan directly onto a seller's subscription - bypasses billing/checkout (FR-8.2)." />
            <form onSubmit={grantPlan} className="space-y-3">
              <Field label="Seller ID">
                <Input value={grantSellerId} onChange={(e) => setGrantSellerId(e.target.value)} required />
              </Field>
              <Field label="Plan">
                <Select value={grantPlanId} onChange={(e) => setGrantPlanId(e.target.value)} required>
                  <option value="">Select a plan...</option>
                  {allPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.planGroup})
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit">Grant plan</Button>
            </form>
          </DashCard>

          <DashCard>
            <DashCardHeader title="Create a platform promo code" description="FR-7.9" />
            <form onSubmit={createPromoCode} className="space-y-3">
              <Field label="Code">
                <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} required />
              </Field>
              <Field label="Discount type">
                <Select value={promoDiscountType} onChange={(e) => setPromoDiscountType(e.target.value as typeof promoDiscountType)}>
                  <option value="percent">percent off</option>
                  <option value="fixed">fixed amount off</option>
                </Select>
              </Field>
              <Field label="Discount value">
                <Input type="number" min={0} value={promoDiscountValue} onChange={(e) => setPromoDiscountValue(e.target.value)} required />
              </Field>
              <Button type="submit">Create promo code</Button>
            </form>
          </DashCard>
        </div>
      </div>
    </div>
  );
}
