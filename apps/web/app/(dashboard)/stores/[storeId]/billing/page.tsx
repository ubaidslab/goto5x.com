"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface Plan {
  id: string;
  name: string;
  planGroup: "individual" | "team" | "supplier";
  tierOrder: number;
  price: string;
  seatPrice: string | null;
  currency: string;
  billingInterval: "monthly" | "yearly" | "none";
  isActive: boolean;
}

interface Subscription {
  id: string;
  planId: string;
  pendingPlanId: string | null;
  currentPeriodEnd: string | null;
  plan: Plan;
  pendingPlan: Plan | null;
}

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

// FR-7.17 - the whole point: this page renders entirely from /plans data,
// never a hard-coded tier list. Adding/reordering a tier changes what's
// displayed here with no deploy.
export default function BillingPage() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<{ individual: Plan[]; team: Plan[]; supplier: Plan[] } | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[] | null>(null);
  const [memberships, setMemberships] = useState<TeamMembership[] | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamPlanId, setTeamPlanId] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});

  function loadAll() {
    api.get<{ individual: Plan[]; team: Plan[]; supplier: Plan[] }>("/plans").then(setPlans).catch(() => {});
    api
      .get<Subscription>("/sellers/me/subscription")
      .then(setSubscription)
      .catch(() => {})
      .finally(() => setLoaded(true));
    api.get<Team[]>("/sellers/me/teams").then(setTeams).catch(() => {});
    api.get<TeamMembership[]>("/sellers/me/team-membership").then(setMemberships).catch(() => {});
  }

  useEffect(loadAll, []);

  async function changePlan(planId: string) {
    setError(null);
    setChangingPlanId(planId);
    try {
      const updated = await api.post<Subscription>("/sellers/me/subscription/change", { planId });
      setSubscription(updated);
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

  return (
    <div>
      <PageHeader title="Plans & Billing" description="Your plan, upgrade options, and teams." />
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title="Current plan" />
          <CardBody>
            {subscription && (
              <div className="space-y-1 text-sm text-ink">
                <p>
                  <span className="font-medium">{subscription.plan.name}</span>{" "}
                  <span className="text-ink-muted">
                    ({subscription.plan.price === "0" ? "free" : `${subscription.plan.currency} ${subscription.plan.price}/${subscription.plan.billingInterval}`})
                  </span>
                </p>
                {subscription.pendingPlan && (
                  <p className="text-ink-muted">
                    Changing to <span className="font-medium">{subscription.pendingPlan.name}</span> at the end of the
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

        {!activeMembership && plans && (
          <Card>
            <CardHeader title="Available plans" description="Upgrading or downgrading takes effect at your next billing cycle." />
            <CardBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {plans.individual.map((plan) => {
                  const isCurrent = subscription?.planId === plan.id;
                  const isPending = subscription?.pendingPlanId === plan.id;
                  return (
                    <div key={plan.id} className="flex flex-col gap-2 rounded-md border border-border p-4">
                      <p className="font-medium text-ink">{plan.name}</p>
                      <p className="text-sm text-ink-muted">
                        {plan.price === "0" ? "Free" : `${plan.currency} ${plan.price}/${plan.billingInterval}`}
                      </p>
                      {isCurrent ? (
                        <Badge tone="success">Current plan</Badge>
                      ) : isPending ? (
                        <Badge tone="info">Scheduled</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => changePlan(plan.id)}
                          loading={changingPlanId === plan.id}
                        >
                          Switch to this plan
                        </Button>
                      )}
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
                Leaving is always available and never suspends your store - you downgrade to Free at the end of the
                current period.
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
