"use client";

import { useEffect, useState } from "react";

interface EligibilityCriterion {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

interface Application {
  id: string;
  status: "pending_review" | "approved" | "rejected";
  feeAmount: number;
  currency: string;
  eligibilitySnapshot: { criteria: EligibilityCriterion[]; allPass: boolean };
  createdAt: string;
  store: { id: string; name: string; slug: string };
  seller: { id: string; businessName: string };
}

interface ReReviewStore {
  id: string;
  name: string;
  slug: string;
  reReviewFlaggedAt: string;
  reReviewReason: string;
}

/**
 * SRS §5.35 - the mandatory admin audit queue (FR-35.2): every application
 * shows the frozen eligibility snapshot the reviewer needs (health/T&S/KYC
 * picture) so a decision can be made without leaving this screen. Also
 * surfaces the drift-triggered re-review queue (FR-35.5) - bare functional
 * view, no design pass yet, same discipline as the other admin screens.
 */
export default function AdminVerificationPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [queue, setQueue] = useState<Application[]>([]);
  const [reReview, setReReview] = useState<ReReviewStore[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}` };
  }

  function load() {
    fetch(`${apiBase}/admin/verification/applications`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setQueue)
      .catch(() => {});
    fetch(`${apiBase}/admin/verification/re-review`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setReReview)
      .catch(() => {});
  }

  useEffect(load, [apiBase]);

  async function decide(applicationId: string, decision: "approve" | "reject") {
    await fetch(`${apiBase}/admin/verification/applications/${applicationId}/${decision}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes[applicationId] }),
    });
    load();
  }

  async function clearReReview(storeId: string) {
    await fetch(`${apiBase}/admin/verification/stores/${storeId}/re-review/clear`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes[storeId] }),
    });
    load();
  }

  /** Confirming a flagged re-review as "revoke" is the same standing revoke action FR-35.5 gives admins any time - it requires a reason. */
  async function confirmRevoke(storeId: string) {
    const reason = notes[storeId]?.trim();
    if (!reason) {
      alert("Enter a reason before revoking.");
      return;
    }
    await fetch(`${apiBase}/admin/verification/stores/${storeId}/revoke`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ notes: reason }),
    });
    load();
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Verified Store Program</h1>
      <p>Mandatory admin audit queue - approving is never automatic, even when every criterion passed.</p>

      <h2>Pending applications</h2>
      {queue.length === 0 && <p>No applications pending review.</p>}
      {queue.map((app) => (
        <div key={app.id} style={{ border: "1px solid #ccc", padding: 12, marginBottom: 12 }}>
          <p>
            <strong>{app.store.name}</strong> ({app.store.slug}) - {app.seller.businessName}
          </p>
          <p>Fee: Rs. {Number(app.feeAmount).toFixed(2)} - applied {new Date(app.createdAt).toLocaleString()}</p>
          <ul>
            {app.eligibilitySnapshot.criteria.map((c) => (
              <li key={c.key}>
                {c.pass ? "✓" : "✗"} {c.label} - {c.detail}
              </li>
            ))}
          </ul>
          <textarea
            placeholder="Decision notes (optional)"
            value={notes[app.id] ?? ""}
            onChange={(e) => setNotes((n) => ({ ...n, [app.id]: e.target.value }))}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <button onClick={() => decide(app.id, "approve")}>Approve</button>{" "}
          <button onClick={() => decide(app.id, "reject")}>Reject (refunds fee)</button>
        </div>
      ))}

      <h2>Flagged for re-review</h2>
      {reReview.length === 0 && <p>No verified stores currently flagged.</p>}
      {reReview.map((store) => (
        <div key={store.id} style={{ border: "1px solid #ccc", padding: 12, marginBottom: 12 }}>
          <p>
            <strong>{store.name}</strong> ({store.slug}) - flagged {new Date(store.reReviewFlaggedAt).toLocaleString()}
          </p>
          <p>Reason: {store.reReviewReason}</p>
          <textarea
            placeholder="Notes (required to revoke)"
            value={notes[store.id] ?? ""}
            onChange={(e) => setNotes((n) => ({ ...n, [store.id]: e.target.value }))}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <button onClick={() => clearReReview(store.id)}>Clear - keep verified</button>{" "}
          <button onClick={() => confirmRevoke(store.id)}>Confirm - revoke</button>
        </div>
      ))}
    </div>
  );
}
