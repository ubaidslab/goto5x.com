"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";

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

/**
 * Module 20 (SRS §5.6e, FR-6.23) - repurposes Module 17's admin commission-
 * invoice verification screen, not rebuilt from scratch: identical
 * list-and-verify pattern, now verifying wallet top-up requests (seller and
 * supplier) instead of invoices. The old commission-invoicing mechanism is
 * dormant (FR-6.28) - this screen no longer has anything to show for it.
 * Bare view (no design pass yet), same precedent as every other new admin screen.
 */
export default function AdminWalletTopUpsPage() {
  const confirm = useConfirm();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [requests, setRequests] = useState<TopUpRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  function load() {
    fetch(`${apiBase}/admin/wallet-topups`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(load, [apiBase]);

  async function verify(id: string) {
    setError(null);
    const res = await fetch(`${apiBase}/admin/wallet-topups/${id}/verify`, { method: "POST", headers: authHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? "Couldn't verify that top-up.");
      return;
    }
    load();
  }

  async function reject(id: string) {
    setError(null);
    const res = await fetch(`${apiBase}/admin/wallet-topups/${id}/reject`, { method: "POST", headers: authHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? "Couldn't reject that top-up.");
      return;
    }
    load();
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Module 25 P2 - bulk actions reuse the existing per-item verify/reject endpoints; no new bulk backend endpoint needed. */
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
    const results = await Promise.all(
      [...selected].map((id) => fetch(`${apiBase}/admin/wallet-topups/${id}/${decision}`, { method: "POST", headers: authHeaders() })),
    );
    if (results.some((r) => !r.ok)) {
      setError(`Some requests couldn't be ${decision === "verify" ? "verified" : "rejected"} - check their status below.`);
    }
    setSelected(new Set());
    load();
  }

  if (!requests) return <p>Loading...</p>;

  return (
    <main>
      <h1>Wallet top-ups - payment verification (bare view - no design pass yet)</h1>
      <p>
        Seller and supplier wallet top-up requests, direct-collection style (SRS §5.6e) - verify a bank transfer to
        credit the wallet, or reject a request that never arrived.
      </p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <p>
        <button onClick={() => decideSelected("verify")} disabled={selected.size === 0}>
          Verify selected ({selected.size})
        </button>{" "}
        <button onClick={() => decideSelected("reject")} disabled={selected.size === 0}>
          Reject selected ({selected.size})
        </button>
      </p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th></th>
            <th>Owner type</th>
            <th>Owner ID</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Requested</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>
                {r.status === "pending" && <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelected(r.id)} />}
              </td>
              <td>{r.ownerType}</td>
              <td>{r.ownerId}</td>
              <td>
                {r.currency} {r.amount}
              </td>
              <td>{r.method}</td>
              <td>{r.status}</td>
              <td>{new Date(r.requestedAt).toLocaleString()}</td>
              <td>
                {r.status === "pending" && (
                  <>
                    <button onClick={() => verify(r.id)}>Verify</button>{" "}
                    <button onClick={() => reject(r.id)}>Reject</button>
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
