"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";

interface Payout {
  id: string;
  sellerId: string;
  amount: string;
  currency: string;
  status: string;
  requestedAt: string;
  paymentReference: string | null;
}

/**
 * Module 25 P1 (SRS §5.33 FR-33.9/FR-33.11) - the growth-program payout
 * approval queue, API-only before this module. Deliberately not merged
 * with the wallet top-ups screen - this moves money OUT (a disbursement),
 * top-ups move money IN. Bare functional view (no design pass yet).
 */
export default function AdminGrowthWithdrawalsPage() {
  const [queue, setQueue] = useState<Payout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [paymentRef, setPaymentRef] = useState<Record<string, string>>({});

  function load() {
    adminApi
      .get<Payout[]>("/admin/growth-programs/withdrawals/queue")
      .then(setQueue)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load the queue."));
  }

  useEffect(load, []);

  async function approve(id: string) {
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/${id}/approve`, { notes: notes[id] || undefined });
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't approve this payout.");
    }
  }

  async function markProcessing(id: string) {
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/${id}/processing`);
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't mark this payout processing.");
    }
  }

  async function markPaid(id: string) {
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/${id}/paid`, { paymentReference: paymentRef[id] || undefined });
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't mark this payout paid.");
    }
  }

  async function reject(id: string) {
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/${id}/reject`, { notes: notes[id] || undefined });
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't reject this payout.");
    }
  }

  if (error) return <main>{error}</main>;
  if (!queue) return <main>Loading...</main>;

  return (
    <main>
      <h1>Growth programs - withdrawals (bare view - no design pass yet)</h1>
      <p>Approve, process, mark paid, or reject a program participant's payout request. A clawback is a per-seller action (seller 360°).</p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Seller</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Requested</th>
            <th>Notes / payment ref</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((p) => (
            <tr key={p.id}>
              <td>{p.sellerId}</td>
              <td>
                {p.currency} {p.amount}
              </td>
              <td>{p.status}</td>
              <td>{new Date(p.requestedAt).toLocaleString()}</td>
              <td>
                {p.status === "processing" ? (
                  <input
                    value={paymentRef[p.id] ?? ""}
                    onChange={(e) => setPaymentRef((n) => ({ ...n, [p.id]: e.target.value }))}
                    placeholder="Payment reference"
                  />
                ) : (
                  <input
                    value={notes[p.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                    placeholder="Decision notes"
                  />
                )}
              </td>
              <td>
                {p.status === "requested" && (
                  <>
                    <button onClick={() => approve(p.id)}>Approve</button>{" "}
                    <button onClick={() => reject(p.id)}>Reject</button>
                  </>
                )}
                {p.status === "approved" && <button onClick={() => markProcessing(p.id)}>Mark processing</button>}
                {p.status === "processing" && <button onClick={() => markPaid(p.id)}>Mark paid</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
