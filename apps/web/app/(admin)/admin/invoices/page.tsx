"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DashCard } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { adminApi } from "@/lib/admin-api";

interface TopUpRequest {
  id: string;
  ownerType: "seller" | "supplier";
  ownerId: string;
  amount: string;
  currency: string;
  method: string;
  status: "pending" | "verified" | "rejected";
  requestedAt: string;
  verifiedAt: string | null;
}

const statusTone: Record<TopUpRequest["status"], "warning" | "success" | "neutral"> = {
  pending: "warning",
  verified: "success",
  rejected: "neutral",
};

/**
 * Phase 6c (Admin Terminal re-skin) - Module 20's wallet top-up
 * verification screen, restyled onto DashCard. Every action preserved:
 * per-row verify/reject, bulk verify/reject with the real per-item
 * {succeeded, failed} bulk-decide endpoint.
 */
export default function AdminWalletTopUpsPage() {
  const confirm = useConfirm();
  const [requests, setRequests] = useState<TopUpRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function load() {
    adminApi
      .get<TopUpRequest[]>("/admin/wallet-topups")
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(load, []);

  async function verify(id: string) {
    setError(null);
    try {
      await adminApi.post(`/admin/wallet-topups/${id}/verify`);
      load();
    } catch {
      setError("Couldn't verify that top-up.");
    }
  }

  async function reject(id: string) {
    setError(null);
    try {
      await adminApi.post(`/admin/wallet-topups/${id}/reject`);
      load();
    } catch {
      setError("Couldn't reject that top-up.");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** SRS FR-8.17 (Module 89) - one bulk-decide request instead of a per-item Promise.all fan-out; the API reports a real per-item {succeeded, failed} shape. */
  async function decideSelected(decision: "verify" | "reject") {
    setError(null);
    const ok = await confirm({
      title: `${decision === "verify" ? "Verify" : "Reject"} ${selected.size} top-up request${selected.size === 1 ? "" : "s"}?`,
      description:
        decision === "verify"
          ? "This credits each selected seller/supplier's wallet by the requested amount."
          : "This permanently rejects each selected top-up request - it will not credit any wallet.",
      confirmLabel: decision === "verify" ? "Verify selected" : "Reject selected",
      tone: decision === "reject" ? "danger" : "default",
    });
    if (!ok) return;
    try {
      const body = await adminApi.post<{ failed?: string[] }>("/admin/wallet-topups/bulk-decide", { topUpIds: [...selected], decision });
      if (body.failed?.length) {
        setError(
          `${body.failed.length} of ${selected.size} request${selected.size === 1 ? "" : "s"} couldn't be ${decision === "verify" ? "verified" : "rejected"} - check their status below.`,
        );
      }
    } catch {
      setError(`Some requests couldn't be ${decision === "verify" ? "verified" : "rejected"}.`);
    }
    setSelected(new Set());
    load();
  }

  if (!requests) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Wallet top-ups"
        description="Seller and supplier wallet top-up requests, direct-collection style (SRS §5.6e) - verify a bank transfer to credit the wallet, or reject a request that never arrived."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {selected.size > 0 && (
        <DashCard className="mb-4 flex gap-2">
          <Button onClick={() => decideSelected("verify")}>Verify selected ({selected.size})</Button>
          <Button variant="danger" onClick={() => decideSelected("reject")}>
            Reject selected ({selected.size})
          </Button>
        </DashCard>
      )}

      {requests.length === 0 ? (
        <DashCard>
          <EmptyState title="No top-up requests" description="Seller and supplier wallet top-up requests will show up here." />
        </DashCard>
      ) : (
        <DashCard className="divide-y divide-border">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                {r.status === "pending" && (
                  <Checkbox aria-label={`Select request ${r.id}`} checked={selected.has(r.id)} onCheckedChange={() => toggleSelected(r.id)} />
                )}
                <div>
                  <p className="text-sm font-medium text-ink">
                    {r.ownerType} <span className="font-normal text-ink-muted">· {r.ownerId.slice(0, 8)}</span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {r.currency} {r.amount} · {r.method} · {new Date(r.requestedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                {r.status === "pending" && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => verify(r.id)}>
                      Verify
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => reject(r.id)}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </DashCard>
      )}
    </div>
  );
}
