"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { adminApi, AdminApiError } from "@/lib/admin-api";

type LifecycleStatus = "active" | "warned" | "restricted" | "suspended" | "banned";

interface Seller {
  id: string;
  businessName: string;
  activationStatus: "auto_approved" | "pending_review" | "blocked";
  lifecycleStatus: LifecycleStatus;
  riskScore: number | null;
}

const LIFECYCLE_STATUSES: LifecycleStatus[] = ["active", "warned", "restricted", "suspended", "banned"];
const lifecycleTone: Record<LifecycleStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  warned: "warning",
  restricted: "warning",
  suspended: "danger",
  banned: "danger",
};

/**
 * Phase 6c (Admin Terminal re-skin) - SRS §5.29/FR-29.4's T&S enforcement
 * ladder, restyled onto DashCard/Badge/Button. Every action preserved:
 * filter by lifecycle status, approve held activation, move along the
 * ladder (reason-required, confirm-gated), impersonate/end support session.
 */
export default function AdminSellersPage() {
  const confirm = useConfirm();
  const [filter, setFilter] = useState<LifecycleStatus>("active");
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  // v0.23 impersonation-transparency amendment (FR-8.4) - tracked here (the
  // admin's own tab) so "End session" can call the admin-guarded end
  // endpoint with the admin's own token; the impersonation token itself
  // never authenticates as an admin.
  const [activeSessions, setActiveSessions] = useState<Record<string, string>>({});

  function load() {
    adminApi
      .get<Seller[]>(`/admin/sellers?lifecycleStatus=${filter}`)
      .then(setSellers)
      .catch(() => setSellers([]));
  }

  useEffect(load, [filter]);

  async function approveActivation(sellerId: string) {
    setError(null);
    try {
      await adminApi.post(`/admin/sellers/${sellerId}/activation/approve`, {});
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't approve that activation.");
    }
  }

  async function setLifecycleStatus(sellerId: string, status: LifecycleStatus, businessName: string, currentStatus: LifecycleStatus) {
    setError(null);
    if (!reason) {
      setError("A reason is required for every lifecycle action.");
      return;
    }
    const ok = await confirm({
      title: `Set ${businessName} to "${status}"?`,
      description: `This changes the seller's lifecycle status and is visible to the seller. Reason: ${reason}`,
      changes: [{ label: "Lifecycle status", from: currentStatus, to: status }],
      confirmLabel: `Set ${status}`,
      tone: status === "banned" || status === "suspended" ? "danger" : "default",
    });
    if (!ok) return;
    try {
      await adminApi.post(`/admin/sellers/${sellerId}/lifecycle`, { status, reason });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't update that seller's lifecycle status.");
    }
  }

  /** FR-8.4 - reason-required, time-boxed "login as seller" mode. */
  async function impersonate(sellerId: string) {
    const impersonationReason = window.prompt("Reason for this support session:");
    if (!impersonationReason) return;
    setError(null);
    try {
      const body = await adminApi.post<{ accessToken: string; impersonationSessionId: string }>(`/admin/sellers/${sellerId}/impersonate`, {
        reason: impersonationReason,
      });
      setActiveSessions({ ...activeSessions, [sellerId]: body.impersonationSessionId });
      window.open(`/impersonate?token=${encodeURIComponent(body.accessToken)}&sessionId=${body.impersonationSessionId}`, "_blank");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't start a support session for this seller.");
    }
  }

  async function endImpersonation(sellerId: string) {
    const sessionId = activeSessions[sellerId];
    if (!sessionId) return;
    await adminApi.post(`/admin/impersonation/${sessionId}/end`, {});
    const { [sellerId]: _removed, ...rest } = activeSessions;
    setActiveSessions(rest);
  }

  return (
    <div>
      <PageHeader title="Sellers" description="Review sellers by trust-and-safety status, approve held activations, and move a seller along the enforcement ladder." />

      {error && <Alert tone="danger">{error}</Alert>}

      <DashCard className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <Field label="Filter by lifecycle status">
              <Select value={filter} onChange={(e) => setFilter(e.target.value as LifecycleStatus)}>
                {LIFECYCLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Reason (required for every action below)">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you taking this action?" />
            </Field>
          </div>
        </div>
      </DashCard>

      <DashCard>
        <DashCardHeader title={`Sellers (${sellers.length})`} />
        <div className="divide-y divide-border">
          {sellers.map((seller) => (
            <div key={seller.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink">{seller.businessName}</span>
                  <Badge tone={lifecycleTone[seller.lifecycleStatus]}>{seller.lifecycleStatus}</Badge>
                  <Badge tone={seller.activationStatus === "auto_approved" ? "success" : "warning"}>{seller.activationStatus}</Badge>
                  <span className="text-xs text-ink-muted">Risk: {seller.riskScore ?? "-"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {seller.activationStatus !== "auto_approved" && (
                  <Button variant="secondary" size="sm" onClick={() => approveActivation(seller.id)}>
                    Approve activation
                  </Button>
                )}
                {LIFECYCLE_STATUSES.filter((s) => s !== seller.lifecycleStatus).map((s) => (
                  <Button
                    key={s}
                    variant={s === "banned" || s === "suspended" ? "danger" : "ghost"}
                    size="sm"
                    onClick={() => setLifecycleStatus(seller.id, s, seller.businessName, seller.lifecycleStatus)}
                  >
                    Set {s}
                  </Button>
                ))}
                {activeSessions[seller.id] ? (
                  <Button variant="ghost" size="sm" onClick={() => endImpersonation(seller.id)}>
                    End support session
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => impersonate(seller.id)}>
                    Impersonate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DashCard>
    </div>
  );
}
