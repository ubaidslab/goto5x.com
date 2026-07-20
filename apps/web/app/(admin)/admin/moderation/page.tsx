"use client";

import { useEffect, useState } from "react";

interface QueuedProduct {
  id: string;
  title: string;
  description: string | null;
  moderationNotes: string | null;
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

  if (!queue) return <p>Loading...</p>;

  return (
    <main>
      <h1>Moderation queue (bare view - no design pass yet)</h1>
      <p>Listings flagged for prohibited/counterfeit content or restricted keywords, awaiting review.</p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {queue.length === 0 ? (
        <p>The queue is empty.</p>
      ) : (
        <table border={1} cellPadding={4}>
          <thead>
            <tr>
              <th>Store</th>
              <th>Product</th>
              <th>Description</th>
              <th>Notes</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((product) => (
              <tr key={product.id}>
                <td>{product.store?.name ?? "-"}</td>
                <td>{product.title}</td>
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
      )}
    </main>
  );
}
