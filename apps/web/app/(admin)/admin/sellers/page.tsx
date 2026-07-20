"use client";

import { useEffect, useState } from "react";

type LifecycleStatus = "active" | "warned" | "restricted" | "suspended" | "banned";

interface Seller {
  id: string;
  businessName: string;
  activationStatus: "auto_approved" | "pending_review" | "blocked";
  lifecycleStatus: LifecycleStatus;
  riskScore: number | null;
}

const LIFECYCLE_STATUSES: LifecycleStatus[] = ["active", "warned", "restricted", "suspended", "banned"];

/**
 * SRS §5.29/FR-29.4 - the T&S enforcement ladder's admin view (bare, no
 * design pass yet). Lists sellers by lifecycle status; lets an admin
 * approve a held activation (FR-30.5) or move a seller along the ladder,
 * always with a required reason (audited).
 */
export default function AdminSellersPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [filter, setFilter] = useState<LifecycleStatus>("active");
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [reason, setReason] = useState("");
  // v0.23 impersonation-transparency amendment (FR-8.4) - tracked here (the
  // admin's own tab) so "End session" can call the admin-guarded end
  // endpoint with the admin's own token; the impersonation token itself
  // never authenticates as an admin.
  const [activeSessions, setActiveSessions] = useState<Record<string, string>>({});

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}` };
  }

  function load() {
    fetch(`${apiBase}/admin/sellers?lifecycleStatus=${filter}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setSellers)
      .catch(() => {});
  }

  useEffect(load, [apiBase, filter]);

  async function approveActivation(sellerId: string) {
    await fetch(`${apiBase}/admin/sellers/${sellerId}/activation/approve`, {
      method: "POST",
      headers: authHeaders(),
    });
    load();
  }

  async function setLifecycleStatus(sellerId: string, status: LifecycleStatus) {
    if (!reason) {
      alert("A reason is required for every lifecycle action.");
      return;
    }
    await fetch(`${apiBase}/admin/sellers/${sellerId}/lifecycle`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    });
    load();
  }

  /** FR-8.4 - reason-required, time-boxed "login as seller" mode. */
  async function impersonate(sellerId: string) {
    const impersonationReason = window.prompt("Reason for this support session:");
    if (!impersonationReason) return;
    const res = await fetch(`${apiBase}/admin/sellers/${sellerId}/impersonate`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ reason: impersonationReason }),
    });
    if (!res.ok) {
      alert("Couldn't start a support session for this seller.");
      return;
    }
    const body = await res.json();
    setActiveSessions({ ...activeSessions, [sellerId]: body.impersonationSessionId });
    window.open(`/impersonate?token=${encodeURIComponent(body.accessToken)}&sessionId=${body.impersonationSessionId}`, "_blank");
  }

  async function endImpersonation(sellerId: string) {
    const sessionId = activeSessions[sellerId];
    if (!sessionId) return;
    await fetch(`${apiBase}/admin/impersonation/${sessionId}/end`, { method: "POST", headers: authHeaders() });
    const { [sellerId]: _removed, ...rest } = activeSessions;
    setActiveSessions(rest);
  }

  return (
    <main>
      <h1>Sellers - lifecycle control (bare view - no design pass yet)</h1>
      <p>Review sellers by trust-and-safety status, approve held activations, and move a seller along the enforcement ladder.</p>

      <label>
        Filter by lifecycle status:{" "}
        <select value={filter} onChange={(e) => setFilter(e.target.value as LifecycleStatus)}>
          {LIFECYCLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <p>
        <label>
          Reason (required for every action below): <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Business name</th>
            <th>Activation status</th>
            <th>Lifecycle status</th>
            <th>Risk score</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sellers.map((seller) => (
            <tr key={seller.id}>
              <td>{seller.businessName}</td>
              <td>{seller.activationStatus}</td>
              <td>{seller.lifecycleStatus}</td>
              <td>{seller.riskScore ?? "-"}</td>
              <td>
                {seller.activationStatus !== "auto_approved" && (
                  <button onClick={() => approveActivation(seller.id)}>Approve activation</button>
                )}{" "}
                {LIFECYCLE_STATUSES.filter((s) => s !== seller.lifecycleStatus).map((s) => (
                  <button key={s} onClick={() => setLifecycleStatus(seller.id, s)}>
                    Set {s}
                  </button>
                ))}{" "}
                {activeSessions[seller.id] ? (
                  <button onClick={() => endImpersonation(seller.id)}>End support session</button>
                ) : (
                  <button onClick={() => impersonate(seller.id)}>Impersonate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
