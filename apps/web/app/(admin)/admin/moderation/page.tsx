"use client";

import { useEffect, useState } from "react";

interface QueuedProduct {
  id: string;
  title: string;
  description: string | null;
  moderationNotes: string | null;
  sourceType: "self" | "supplier";
  store: { name: string; slug: string } | null;
}

/**
 * SRS §4/FR-27.6 - the moderation queue's bare functional admin page (Module
 * 6 built the four API endpoints only; this is the UI, Module 17's job per
 * docs/build-plan.md). Reachable by the narrowly-scoped REVIEWER admin
 * sub-role too - a REVIEWER account sees only this page in the admin
 * terminal (enforced server-side by AdminAuthGuard, not by anything here).
 */
export default function AdminModerationPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [queue, setQueue] = useState<QueuedProduct[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkNotes, setBulkNotes] = useState("");
  const [lookupProductId, setLookupProductId] = useState("");
  const [lookupNotes, setLookupNotes] = useState("");
  const [lookupResult, setLookupResult] = useState<string | null>(null);

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  function load() {
    fetch(`${apiBase}/admin/moderation/queue`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setQueue)
      .catch(() => setQueue([]));
  }

  useEffect(load, [apiBase]);

  async function decide(productId: string, decision: "approve" | "reject") {
    setError(null);
    const res = await fetch(`${apiBase}/admin/moderation/queue/${productId}/${decision}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ notes: notes[productId] ?? "" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? "Couldn't record that decision.");
      return;
    }
    load();
  }

  function toggleSelected(productId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  /** Module 25 P2 - bulk actions reuse the existing per-item decide endpoint (already idempotent, already audit-logged); no new bulk backend endpoint needed. */
  async function decideSelected(decision: "approve" | "reject") {
    setError(null);
    if (decision === "reject" && !bulkNotes.trim()) {
      setError("A reason is required to reject (the field above) - it's shown to the seller.");
      return;
    }
    const results = await Promise.all(
      [...selected].map((productId) =>
        fetch(`${apiBase}/admin/moderation/queue/${productId}/${decision}`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ notes: bulkNotes }),
        }),
      ),
    );
    if (results.some((r) => !r.ok)) {
      setError(`Some products couldn't be ${decision === "approve" ? "approved" : "rejected"} - check the queue below.`);
    }
    setSelected(new Set());
    setBulkNotes("");
    load();
  }

  /**
   * Module 37 (SRS §5.54/FR-54.2) - unlike the queue above (pending
   * products only), this reaches ANY product by id regardless of its
   * current moderation status - the queue list has no concept of
   * "already approved" products to click through to, so a direct
   * id lookup is the minimal real action surface (no new product-detail
   * page, consistent with this page's own "bare view" discipline).
   */
  async function forceRemoveOrRestore(action: "remove" | "restore") {
    if (!lookupProductId.trim()) {
      setLookupResult("Enter a product id first.");
      return;
    }
    const res = await fetch(`${apiBase}/admin/products/${lookupProductId.trim()}/${action}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ notes: lookupNotes }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLookupResult(body.message ?? `Couldn't ${action} that product.`);
      return;
    }
    setLookupResult(`Product ${lookupProductId.trim()} is now: ${body.moderationStatus}`);
  }

  if (!queue) return <p>Loading...</p>;

  return (
    <main>
      <h1>Moderation queue (bare view - no design pass yet)</h1>
      <p>Listings flagged for prohibited/counterfeit content or restricted keywords, awaiting review.</p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <h2>Force remove / restore a product</h2>
      <p>
        Instant takedown for a product in ANY moderation status (not just this queue) - SRS §5.54/FR-54.2. Also how
        a supplier-listed product (source: supplier, see the queue below) can be taken down directly.
      </p>
      <p>
        <label>
          Product id: <input value={lookupProductId} onChange={(e) => setLookupProductId(e.target.value)} placeholder="uuid" />
        </label>{" "}
        <label>
          Notes: <input value={lookupNotes} onChange={(e) => setLookupNotes(e.target.value)} />
        </label>{" "}
        <button onClick={() => forceRemoveOrRestore("remove")}>Remove</button>{" "}
        <button onClick={() => forceRemoveOrRestore("restore")}>Restore</button>
      </p>
      {lookupResult && <p>{lookupResult}</p>}

      {queue.length === 0 ? (
        <p>The queue is empty.</p>
      ) : (
        <>
          <p>
            <label>
              Notes for bulk action: <input value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} placeholder="Reviewer notes" />
            </label>{" "}
            <button onClick={() => decideSelected("approve")} disabled={selected.size === 0}>
              Approve selected ({selected.size})
            </button>{" "}
            <button onClick={() => decideSelected("reject")} disabled={selected.size === 0}>
              Reject selected ({selected.size})
            </button>
          </p>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th></th>
                <th>Store</th>
                <th>Product</th>
                <th>Source</th>
                <th>Description</th>
                <th>Notes</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((product) => (
                <tr key={product.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleSelected(product.id)} />
                  </td>
                  <td>{product.store?.name ?? "-"}</td>
                  <td>{product.title}</td>
                  <td>{product.sourceType === "supplier" ? "Supplier-listed" : "Self"}</td>
                  <td>{product.description ?? "-"}</td>
                  <td>
                    <input
                      value={notes[product.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [product.id]: e.target.value })}
                      placeholder="Reviewer notes"
                    />
                  </td>
                  <td>
                    <button onClick={() => decide(product.id, "approve")}>Approve</button>{" "}
                    <button onClick={() => decide(product.id, "reject")}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
