"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

type ReturnStatus = "requested" | "approved" | "rejected" | "completed";

interface ReturnRequest {
  id: string;
  status: ReturnStatus;
  buyerReason: string;
  sellerNote: string | null;
  refundAmount: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  order: { orderNumber: number; totalAmount: string; currency: string; buyerEmail: string };
}

const STATUS_TONE: Record<ReturnStatus, "warning" | "info" | "success" | "danger"> = {
  requested: "warning",
  approved: "info",
  rejected: "danger",
  completed: "success",
};

/** SRS §5.60/FR-60.3/60.4 - the seller's own return queue: approve/reject, then complete (issue the refund) once approved. */
export default function ReturnsPage({ params }: { params: { storeId: string } }) {
  const [requests, setRequests] = useState<ReturnRequest[] | null>(null);
  const [status, setStatus] = useState<ReturnStatus | "">("requested");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});

  function load() {
    const query = status ? `?status=${status}` : "";
    api
      .get<ReturnRequest[]>(`/stores/${params.storeId}/returns${query}`)
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(load, [params.storeId, status]);

  async function decide(returnId: string, next: "approved" | "rejected") {
    setError(null);
    setBusyId(returnId);
    try {
      if (next === "rejected" && !rejectNotes[returnId]?.trim()) {
        throw new ApiError("A reason is required to reject a return request.", 400);
      }
      await api.patch(`/stores/${params.storeId}/returns/${returnId}`, {
        status: next,
        sellerNote: rejectNotes[returnId],
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that return request.");
    } finally {
      setBusyId(null);
    }
  }

  async function complete(returnId: string, orderTotal: string) {
    setError(null);
    setBusyId(returnId);
    try {
      const refundAmount = Number(refundAmounts[returnId] ?? orderTotal);
      if (!refundAmount || refundAmount <= 0) {
        throw new ApiError("Enter a refund amount greater than zero.", 400);
      }
      await api.post(`/stores/${params.storeId}/returns/${returnId}/complete`, { refundAmount });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't complete that refund.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Returns & Refunds"
        description="Approve or reject buyer-initiated return requests, then issue the refund."
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="mb-4 max-w-xs">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ReturnStatus | "")}>
            <option value="requested">Awaiting review</option>
            <option value="approved">Approved - awaiting refund</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
            <option value="">All</option>
          </Select>
        </Field>
      </div>

      {requests === null ? (
        <PageSpinner />
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            title={status === "requested" ? "Nothing awaiting review" : "No return requests here"}
            description="Buyer-submitted return requests appear here from the order-status page."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {requests.map((r) => (
            <div key={r.id} className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    Order #{r.order.orderNumber} · {r.order.buyerEmail}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Requested {new Date(r.requestedAt).toLocaleDateString()} · {r.order.currency} {r.order.totalAmount} order total
                  </p>
                </div>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              </div>

              <p className="mt-2 text-sm text-ink-muted">Buyer reason: {r.buyerReason}</p>
              {r.sellerNote && <p className="mt-1 text-sm text-ink-muted">Your note: {r.sellerNote}</p>}
              {r.refundAmount != null && (
                <p className="mt-1 text-sm text-ink">
                  Refunded: {r.order.currency} {r.refundAmount}
                </p>
              )}

              {r.status === "requested" && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Button variant="secondary" loading={busyId === r.id} onClick={() => decide(r.id, "approved")}>
                    Approve
                  </Button>
                  <div className="min-w-[220px] flex-1">
                    <Field label="Reject reason (required to reject)">
                      <Input
                        value={rejectNotes[r.id] ?? ""}
                        onChange={(e) => setRejectNotes({ ...rejectNotes, [r.id]: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Button variant="ghost" loading={busyId === r.id} onClick={() => decide(r.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              )}

              {r.status === "approved" && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="w-40">
                    <Field label="Refund amount" hint={`Up to ${r.order.currency} ${r.order.totalAmount}`}>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder={r.order.totalAmount}
                        value={refundAmounts[r.id] ?? ""}
                        onChange={(e) => setRefundAmounts({ ...refundAmounts, [r.id]: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Button loading={busyId === r.id} onClick={() => complete(r.id, r.order.totalAmount)}>
                    Issue refund
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
