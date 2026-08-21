"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";

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

/**
 * SRS §5.60/FR-60.5 - admin override, every store, regardless of the
 * seller's own decision (or lack of one). Bare functional view (no design
 * pass yet), matching every other admin queue's own stated discipline.
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
    try {
      if (status === "rejected" && !rejectNotes[returnId]?.trim()) {
        alert("A reason is required to reject a return request.");
        return;
      }
      await adminApi.patch(`/admin/returns/${returnId}`, { status, sellerNote: rejectNotes[returnId] });
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't update that return request.");
    }
  }

  async function complete(returnId: string, orderTotal: string, currency: string) {
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
      alert(err instanceof AdminApiError ? err.message : "Couldn't complete this refund.");
    }
  }

  if (error) return <main>{error}</main>;
  if (!requests) return <main>Loading...</main>;

  return (
    <main>
      <h1>Returns & Refunds (bare view - no design pass yet)</h1>
      <p>Admin override: approve/reject/complete any return request, regardless of the seller's own decision (or lack of one).</p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Store</th>
            <th>Order</th>
            <th>Buyer</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Refunded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.store.name}</td>
              <td>
                #{r.order.orderNumber} ({r.order.currency} {r.order.totalAmount})
              </td>
              <td>{r.order.buyerEmail}</td>
              <td>{r.buyerReason}</td>
              <td>
                {r.status}
                {r.adminOverride && " (admin)"}
              </td>
              <td>{r.refundAmount != null ? `${r.order.currency} ${r.refundAmount}` : "-"}</td>
              <td>
                {(r.status === "requested" || r.status === "approved") && (
                  <>
                    {r.status === "requested" && <button onClick={() => decide(r.id, "approved")}>Approve</button>}
                    <input
                      placeholder="Reject reason"
                      value={rejectNotes[r.id] ?? ""}
                      onChange={(e) => setRejectNotes({ ...rejectNotes, [r.id]: e.target.value })}
                    />
                    <button onClick={() => decide(r.id, "rejected")}>Reject</button>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={r.order.totalAmount}
                      value={refundAmounts[r.id] ?? ""}
                      onChange={(e) => setRefundAmounts({ ...refundAmounts, [r.id]: e.target.value })}
                    />
                    <button onClick={() => complete(r.id, r.order.totalAmount, r.order.currency)}>Complete refund</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
