"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { useConfirm } from "@/components/dashboard/ConfirmDialogProvider";
import { ApiError, api } from "@/lib/dashboard-api";
import { planTierCopy, planTierSubtitle } from "@/lib/plan-tier-copy";

interface Plan {
  id: string;
  name: string;
  planGroup: "individual" | "team" | "supplier";
  tierOrder: number;
  price: string;
  seatPrice: string | null;
  currency: string;
  billingInterval: "monthly" | "yearly" | "none" | "six_month";
  isActive: boolean;
  // FR-7.20 (Module 61) - derived, not stored: the price for each cycle at
  // this plan's current active price. Null for a non-monthly-billed plan
  // group (team/supplier) - no cycle choice applies to those.
  activePrice: number;
  sixMonthPrice: number | null;
  yearlyPrice: number | null;
}

interface Subscription {
  id: string;
  planId: string;
  pendingPlanId: string | null;
  currentPeriodEnd: string | null;
  // FR-7.20 (Module 61) - which cycle this subscription is actually on;
  // the billing-cycle selector below defaults to this, not always monthly.
  billingInterval: "monthly" | "six_month" | "yearly";
  plan: Plan;
  pendingPlan: Plan | null;
}

type Cycle = "monthly" | "six_month" | "yearly";
const CYCLE_LABELS: Record<Cycle, string> = { monthly: "Monthly", six_month: "6 months", yearly: "Yearly" };

interface Team {
  id: string;
  name: string;
  planId: string;
  plan: Plan;
}

interface TeamMembership {
  id: string;
  status: "pending_invite" | "active" | "left" | "declined";
  team: { id: string; name: string; plan: Plan; leader: { businessName: string } };
}

interface PlanFeePaymentRequest {
  id: string;
  planFeePortion: number | null;
  status: "pending" | "verified" | "rejected";
  requestedAt: string;
}

interface PlanFeePaymentPreview {
  planName: string;
  amountDue: number;
  isRenewal: boolean;
  currency: string;
  instructions: string;
}

// FR-6.69 (Module 102) - the two non-terminal response shapes
// requestPlanChange() can hand back instead of an updated Subscription: an
// informational, overridable feature-loss warning, and Module 66's
// pre-existing (previously unhandled by this page) mandatory store-choice
// gate. Both are resolved via the same reusable useConfirm() dialog rather
// than two bespoke ones.
interface DowngradeLoss {
  label: string;
  detail: string;
}

type ChangePlanResult =
  | Subscription
  | { requiresDowngradeConfirmation: true; losses: DowngradeLoss[] }
  | { requiresStoreChoice: true; maxStores: number; activeStores: { id: string; name: string; createdAt: string }[] };

// FR-7.17 - the whole point: this page renders entirely from /plans data,
// never a hard-coded tier list. Adding/reordering a tier changes what's
// displayed here with no deploy.
export default function BillingPage() {
  const confirm = useConfirm();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<{ individual: Plan[]; team: Plan[]; supplier: Plan[] } | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);
  // FR-7.20 (Module 61/103) - defaults to the seller's current cycle once
  // the subscription loads (see the effect below), not always monthly.
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [cycleInitialized, setCycleInitialized] = useState(false);

  const [teams, setTeams] = useState<Team[] | null>(null);
  const [memberships, setMemberships] = useState<TeamMembership[] | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamPlanId, setTeamPlanId] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});

  // Module 73 (v0.38) - the plan-fee payment card. There is no wallet
  // balance/top-up concept for a seller any more - just the amount due
  // right now (first cycle, discounted, or an ordinary renewal at full
  // price) and payment history.
  const [paymentPreview, setPaymentPreview] = useState<PlanFeePaymentPreview | null>(null);
  const [paymentRequests, setPaymentRequests] = useState<PlanFeePaymentRequest[] | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  function loadAll() {
    api.get<{ individual: Plan[]; team: Plan[]; supplier: Plan[] }>("/plans").then(setPlans).catch(() => {});
    api
      .get<Subscription>("/sellers/me/subscription")
      .then(setSubscription)
      .catch(() => {})
      .finally(() => setLoaded(true));
    api.get<Team[]>("/sellers/me/teams").then(setTeams).catch(() => {});
    api.get<TeamMembership[]>("/sellers/me/team-membership").then(setMemberships).catch(() => {});
    api.get<PlanFeePaymentPreview>("/sellers/me/wallet/plan-fee-payment").then(setPaymentPreview).catch(() => setPaymentPreview(null));
    api
      .get<PlanFeePaymentRequest[]>("/sellers/me/wallet/topup-requests")
      .then((all) => setPaymentRequests(all.filter((r) => r.planFeePortion !== null)))
      .catch(() => setPaymentRequests([]));
  }

  useEffect(loadAll, []);

  // FR-7.20 (Module 61/103) - the selector defaults to the seller's actual
  // current cycle, once, the first time the subscription arrives (never
  // resets it back to monthly on a later refetch, e.g. after a plan change).
  useEffect(() => {
    if (subscription && !cycleInitialized) {
      setCycle(subscription.billingInterval);
      setCycleInitialized(true);
    }
  }, [subscription, cycleInitialized]);

  function priceForCycle(plan: Plan, forCycle: Cycle): number {
    if (forCycle === "six_month") return plan.sixMonthPrice ?? plan.activePrice;
    if (forCycle === "yearly") return plan.yearlyPrice ?? plan.activePrice;
    return plan.activePrice;
  }

  function cyclePriceFor(plan: Plan): number {
    return priceForCycle(plan, cycle);
  }

  async function submitPlanFeePayment() {
    setPaymentError(null);
    setPaymentInstructions(null);
    setSubmittingPayment(true);
    try {
      const result = await api.post<{ instructions: string }>("/sellers/me/wallet/plan-fee-payment", {});
      setPaymentInstructions(result.instructions);
      loadAll();
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : "Could not submit that payment.");
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function submitPlanChange(
    planId: string,
    body: { confirmed?: boolean; keepStoreIds?: string[]; billingInterval?: Cycle },
  ): Promise<void> {
    const result = await api.post<ChangePlanResult>("/sellers/me/subscription/change", { planId, ...body });

    // FR-6.69 (Module 102) - informational and overridable: show exactly
    // what would be lost, and only resubmit with confirmed:true if the
    // seller explicitly accepts. A cancel just leaves the current plan in
    // place - no partial state to unwind.
    if ("requiresDowngradeConfirmation" in result) {
      const ok = await confirm({
        title: "This plan doesn't include everything you're using",
        description: "Switching will remove:",
        changes: result.losses.map((loss) => ({ label: loss.label, from: "Included now", to: loss.detail })),
        confirmLabel: "Switch anyway",
        tone: "danger",
      });
      if (!ok) return;
      return submitPlanChange(planId, { ...body, confirmed: true });
    }

    // Module 66 (FR-6.43) - previously unhandled by this page (silently
    // misrendered). No custom multi-store picker here: mirrors
    // applyDowngrade()'s own founder-specified default (oldest stores stay
    // active) and makes it explicit/confirmable instead of silent.
    if ("requiresStoreChoice" in result) {
      const keep = result.activeStores.slice(0, result.maxStores);
      const pause = result.activeStores.slice(result.maxStores);
      const ok = await confirm({
        title: `This plan allows only ${result.maxStores} active store${result.maxStores === 1 ? "" : "s"}`,
        description: `You have ${result.activeStores.length} active stores. Your oldest ${keep.length} will stay active; the rest will be paused (orders paused, not deleted) unless you upgrade again within 30 days.`,
        changes: pause.map((s) => ({ label: s.name, from: "Active", to: "Paused" })),
        confirmLabel: "Continue",
        tone: "danger",
      });
      if (!ok) return;
      return submitPlanChange(planId, { ...body, keepStoreIds: keep.map((s) => s.id) });
    }

    setSubscription(result);
  }

  async function changePlan(planId: string) {
    setError(null);
    setChangingPlanId(planId);
    try {
      await submitPlanChange(planId, { billingInterval: cycle });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change plan.");
    } finally {
      setChangingPlanId(null);
    }
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatingTeam(true);
    try {
      await api.post("/sellers/me/teams", { name: teamName, planId: teamPlanId });
      setTeamName("");
      setTeamPlanId("");
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create team - your plan may not include team-leader eligibility.");
    } finally {
      setCreatingTeam(false);
    }
  }

  async function inviteMember(teamId: string) {
    setError(null);
    try {
      await api.post(`/sellers/me/teams/${teamId}/invite`, { email: inviteEmail[teamId] });
      setInviteEmail((prev) => ({ ...prev, [teamId]: "" }));
      alert("Invite sent.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send invite.");
    }
  }

  async function respondToInvite(teamMemberId: string, action: "accept" | "decline") {
    setError(null);
    try {
      await api.post(`/sellers/me/team-membership/${teamMemberId}/${action}`, action === "accept" ? { consentAccepted: true } : undefined);
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't respond to invite.");
    }
  }

  async function leaveTeam() {
    setError(null);
    try {
      await api.post("/sellers/me/team-membership/leave");
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't leave team.");
    }
  }

  if (!loaded) return <PageSpinner />;

  const activeMembership = memberships?.find((m) => m.status === "active");
  const pendingInvites = memberships?.filter((m) => m.status === "pending_invite") ?? [];
  // A team-sponsored member's subscription.plan is a team-group plan (no
  // cycle-price fields, seat-based) - only an individual-group plan (looked
  // up from /plans, which already computes activePrice/sixMonthPrice/
  // yearlyPrice) has a per-cycle price to show.
  const currentPlanWithCyclePrices = subscription ? plans?.individual.find((p) => p.id === subscription.planId) : undefined;

  return (
    <div>
      <PageHeader title="Plans & Billing" description="Your plan, upgrade options, and teams." />
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-5xl space-y-6">
        <Card>
          <CardHeader title="Current plan" />
          <CardBody>
            {subscription && (
              <div className="space-y-1 text-sm text-ink">
                <p>
                  <span className="font-medium">{subscription.plan.name}</span>
                  {planTierSubtitle(subscription.plan.name) && (
                    <span className="text-ink-muted"> — {planTierSubtitle(subscription.plan.name)}</span>
                  )}{" "}
                  <span className="text-ink-muted">
                    (
                    {subscription.plan.price === "0"
                      ? "free"
                      : currentPlanWithCyclePrices
                        ? `${subscription.plan.currency} ${priceForCycle(currentPlanWithCyclePrices, subscription.billingInterval).toLocaleString()} / ${CYCLE_LABELS[subscription.billingInterval].toLowerCase()}`
                        : `${subscription.plan.currency} ${subscription.plan.price}/${subscription.plan.billingInterval}`}
                    )
                  </span>
                </p>
                {subscription.pendingPlan && (
                  <p className="text-ink-muted">
                    Changing to <span className="font-medium">{subscription.pendingPlan.name}</span>
                    {planTierSubtitle(subscription.pendingPlan.name) && ` (${planTierSubtitle(subscription.pendingPlan.name)})`} at the end of the
                    current period{subscription.currentPeriodEnd && ` (${new Date(subscription.currentPeriodEnd).toLocaleDateString()})`}.
                  </p>
                )}
                {activeMembership && (
                  <p className="text-ink-muted">
                    Sponsored by <span className="font-medium">{activeMembership.team.leader.businessName}</span>&apos;s team
                    (&quot;{activeMembership.team.name}&quot;) - your plan reflects their Team tier while sponsored.
                  </p>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {(paymentRequests?.some((r) => r.status === "pending") ?? false) ? (
          <Alert tone="info">Your plan-fee payment is pending admin verification.</Alert>
        ) : (
          paymentPreview && (
            <Card>
              <CardHeader
                title={paymentPreview.isRenewal ? "Plan fee due" : "Get started"}
                description={`${paymentPreview.planName}${planTierSubtitle(paymentPreview.planName) ? ` (${planTierSubtitle(paymentPreview.planName)})` : ""} - ${paymentPreview.isRenewal ? "renewal" : "first cycle (discounted)"}`}
              />
              <CardBody className="space-y-4">
                {paymentError && <Alert>{paymentError}</Alert>}
                {paymentInstructions && <Alert tone="info">{paymentInstructions}</Alert>}
                <div className="rounded-lg border border-border p-4">
                  <p className="text-3xl font-semibold text-ink">Rs. {paymentPreview.amountDue.toFixed(2)}</p>
                </div>
                <Button loading={submittingPayment} onClick={submitPlanFeePayment}>
                  Pay - Rs. {paymentPreview.amountDue.toFixed(2)}
                </Button>
              </CardBody>
            </Card>
          )
        )}

        {paymentRequests && paymentRequests.length > 0 && (
          <Card>
            <CardHeader title="Payment history" />
            <CardBody className="divide-y divide-border">
              {paymentRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-ink">Rs. {Number(r.planFeePortion ?? 0).toFixed(2)}</p>
                    <p className="text-xs text-ink-muted">{new Date(r.requestedAt).toLocaleString()}</p>
                  </div>
                  <Badge tone={r.status === "verified" ? "success" : r.status === "rejected" ? "danger" : "warning"}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {!activeMembership && plans && (
          <Card>
            <CardHeader title="Available plans" description="What each tier gets you - upgrading or downgrading takes effect at your next billing cycle." />
            <CardBody>
              {/* FR-7.20 (Module 61/103) - the same three cycles the public
                  pricing page's own toggle offers a signing-up seller,
                  extended here to an existing seller switching plans. */}
              <div className="mb-4 inline-flex rounded-full border border-border bg-canvas p-1">
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
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {plans.individual.map((plan) => {
                  const isCurrent = subscription?.planId === plan.id;
                  const isPending = subscription?.pendingPlanId === plan.id;
                  const copyForTier = planTierCopy(plan.name);
                  const cyclePrice = cyclePriceFor(plan);
                  return (
                    <div
                      key={plan.id}
                      className={`flex flex-col rounded-lg border p-4 ${
                        isCurrent ? "border-accent bg-accent-subtle/30" : "border-border bg-surface"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-ink">{plan.name}</p>
                        {planTierSubtitle(plan.name) && <p className="text-xs text-ink-faint">{planTierSubtitle(plan.name)}</p>}
                      </div>

                      {/* Features first, most of the card's visual weight - price is a
                          single de-emphasized line below, not the headline (founder
                          batch A8: features-first, price-last). */}
                      <ul className="mt-3 flex-1 space-y-1.5">
                        {copyForTier.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-1.5 text-xs text-ink-muted">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <p className="mt-4 text-xs text-ink-faint">
                        {cyclePrice === 0 ? "Free" : `${plan.currency} ${cyclePrice.toLocaleString()} / ${CYCLE_LABELS[cycle].toLowerCase()}`}
                      </p>

                      <div className="mt-2">
                        {isCurrent ? (
                          <Badge tone="success">Current plan</Badge>
                        ) : isPending ? (
                          <Badge tone="info">Scheduled</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={() => changePlan(plan.id)}
                            loading={changingPlanId === plan.id}
                          >
                            Switch to this plan
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        )}

        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader title="Team invitations" description="A leader's team dashboard sees only read-only sales analytics - never your store, products, or customers." />
            <CardBody className="space-y-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{invite.team.leader.businessName}</span> invited you to join &quot;{invite.team.name}&quot;
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => respondToInvite(invite.id, "accept")}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => respondToInvite(invite.id, "decline")}>
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {activeMembership && (
          <Card>
            <CardHeader title="Team membership" />
            <CardBody>
              <Button variant="ghost" onClick={leaveTeam}>
                Leave team
              </Button>
              <p className="mt-2 text-xs text-ink-muted">
                Leaving is always available and never suspends your store - you downgrade to Starter at the end of
                the current period.
              </p>
            </CardBody>
          </Card>
        )}

        {!activeMembership && (
          <Card>
            <CardHeader title="Teams" description="Sponsor other sellers' subscriptions if your plan includes team-leader eligibility." />
            <CardBody className="space-y-4">
              {teams && teams.length > 0 && (
                <div className="space-y-3">
                  {teams.map((team) => (
                    <div key={team.id} className="rounded-md border border-border p-3">
                      <p className="font-medium text-ink">
                        {team.name} <span className="text-ink-muted">({team.plan.name})</span>
                      </p>
                      <div className="mt-2 flex items-end gap-2">
                        <div className="flex-1">
                          <Field label="Invite by email">
                            <Input
                              type="email"
                              value={inviteEmail[team.id] ?? ""}
                              onChange={(e) => setInviteEmail((prev) => ({ ...prev, [team.id]: e.target.value }))}
                            />
                          </Field>
                        </div>
                        <Button size="sm" onClick={() => inviteMember(team.id)}>
                          Invite
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={createTeam} className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-ink">Create a new team</p>
                <Field label="Team name">
                  <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
                </Field>
                <Field label="Team tier">
                  <select
                    className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink"
                    value={teamPlanId}
                    onChange={(e) => setTeamPlanId(e.target.value)}
                    required
                  >
                    <option value="">Choose a tier</option>
                    {plans?.team.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({plan.currency} {plan.seatPrice}/seat/mo)
                      </option>
                    ))}
                  </select>
                </Field>
                <Button type="submit" loading={creatingTeam}>
                  Create team
                </Button>
              </form>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
