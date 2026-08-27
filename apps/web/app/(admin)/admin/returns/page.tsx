"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

interface ReturnRequest {
  id: string;
  status: "requested" | "approved" | "rejected" | "completed";
  buyerReason: string;
  sellerNote: string | null;
  refundAmount: string | null;
  adminOverride: boolean;
  requestedAt: string;
  order: { orderNumber: number; totalAmount: string; currency: string; buyerEmail: string };
  store: { name: string };
}

const statusTone: Record<ReturnRequest["status"], "warning" | "success" | "danger" | "neutral"> = {
  requested: "warning",
  approved: "success",
  rejected: "danger",
  completed: "neutral",
};

/**
 * Phase 6d (Admin Terminal re-skin) - SRS §5.60/FR-60.5's admin return/
 * refund override, restyled onto DashCard. Every action preserved:
 * approve, reject (reason-required), complete refund (confirm-gated,
 * editable amount).
 */
export default function AdminReturnsPage() {
  const confirm = useConfirm();
  const [requests, setRequests] = useState<ReturnRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  function load() {
    adminApi
      .get<ReturnRequest[]>("/admin/returns")
      .then(setRequests)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load return requests."));
  }

  useEffect(load, []);

  async function decide(returnId: string, status: "approved" | "rejected") {
    setError(null);
    if (status === "rejected" && !rejectNotes[returnId]?.trim()) {
      setError("A reason is required to reject a return request.");
      return;
    }
    try {
      await adminApi.patch(`/admin/returns/${returnId}`, { status, sellerNote: rejectNotes[returnId] });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't update that return request.");
    }
  }

  async function complete(returnId: string, orderTotal: string, currency: string) {
    setError(null);
    const refundAmount = Number(refundAmounts[returnId] ?? orderTotal);
    const ok = await confirm({
      title: "Complete this refund?",
      description: "This issues the refund to the buyer and cannot be undone.",
      changes: [{ label: "Refund amount", from: "-", to: `${currency} ${refundAmount.toFixed(2)}` }],
      confirmLabel: "Complete refund",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await adminApi.post(`/admin/returns/${returnId}/complete`, { refundAmount });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't complete this refund.");
    }
  }

  if (error && !requests) return <Alert tone="danger">{error}</Alert>;
  if (!requests) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Returns & Refunds"
        description="Admin override: approve/reject/complete any return request, regardless of the seller's own decision (or lack of one)."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {requests.length === 0 ? (
        <DashCard>
          <EmptyState title="No return requests" description="Return requests across every store will show up here." />
        </DashCard>
      ) : (
        <DashCard className="divide-y divide-border">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {r.store.name} · #{r.order.orderNumber}{" "}
                    <span className="font-normal text-ink-muted">
                      ({r.order.currency} {r.order.totalAmount}) · {r.order.buyerEmail}
                    </span>
                  </p>
                  <p className="text-xs text-ink-muted">{r.buyerReason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone[r.status]}>
                    {r.status}
                    {r.adminOverride && " (admin)"}
                  </Badge>
                  {r.refundAmount != null && (
                    <span className="text-xs text-ink-muted">
                      Refunded: {r.order.currency} {r.refundAmount}
                    </span>
                  )}
                </div>
              </div>
              {(r.status === "requested" || r.status === "approved") && (
                <div className="flex flex-wrap items-center gap-2">
                  {r.status === "requested" && (
                    <Button variant="secondary" size="sm" onClick={() => decide(r.id, "approved")}>
                      Approve
                    </Button>
                  )}
                  <Input
                    placeholder="Reject reason"
                    className="h-8 w-40"
                    value={rejectNotes[r.id] ?? ""}
                    onChange={(e) => setRejectNotes({ ...rejectNotes, [r.id]: e.target.value })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => decide(r.id, "rejected")}>
                    Reject
                  </Button>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={r.order.totalAmount}
                    className="h-8 w-32"
                    value={refundAmounts[r.id] ?? ""}
                    onChange={(e) => setRefundAmounts({ ...refundAmounts, [r.id]: e.target.value })}
                  />
                  <Button variant="danger" size="sm" onClick={() => complete(r.id, r.order.totalAmount, r.order.currency)}>
                    Complete refund
                  </Button>
                </div>
              )}
            </div>
          ))}
        </DashCard>
      )}
    </div>
  );
}
