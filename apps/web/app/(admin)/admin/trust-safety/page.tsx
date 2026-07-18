"use client";

import { useEffect, useState } from "react";

interface RateFlag {
  sellerId: string;
  totalOrders: number;
  matchingOrders: number;
  ratePercent: number;
}
interface SignupVelocityFlag {
  ipAddress: string;
  signupCount: number;
}
interface BypassAttemptFlag {
  sellerId: string;
  attemptCount: number;
}
interface PaymentReviewItem {
  storeId: string;
  bankAccountTitle: string | null;
  jazzcashAccountTitle: string | null;
  easypaisaAccountTitle: string | null;
  nameConsistencyStatus: string;
  store: { name: string } | null;
}

/**
 * SRS §5.29/§5.30, §14.29/§14.30 - bare functional view (no design pass
 * yet, same discipline as the other admin screens) covering the T&S risk
 * views (FR-29.3/FR-6.19), the payment-instrument review queue (FR-30.2),
 * and Seller Agreement version publishing (FR-29.1).
 */
export default function AdminTrustSafetyPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [cancellationRate, setCancellationRate] = useState<RateFlag[]>([]);
  const [pendingForeverRate, setPendingForeverRate] = useState<RateFlag[]>([]);
  const [signupVelocity, setSignupVelocity] = useState<SignupVelocityFlag[]>([]);
  const [bypassAttempts, setBypassAttempts] = useState<BypassAttemptFlag[]>([]);
  const [reviewQueue, setReviewQueue] = useState<PaymentReviewItem[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [newVersion, setNewVersion] = useState("");

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}` };
  }

  function load() {
    fetch(`${apiBase}/admin/trust-safety/monitors/cancellation-rate`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setCancellationRate)
      .catch(() => {});
    fetch(`${apiBase}/admin/trust-safety/monitors/pending-forever-rate`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setPendingForeverRate)
      .catch(() => {});
    fetch(`${apiBase}/admin/trust-safety/monitors/signup-velocity`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setSignupVelocity)
      .catch(() => {});
    fetch(`${apiBase}/admin/trust-safety/monitors/bypass-attempts`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setBypassAttempts)
      .catch(() => {});
    fetch(`${apiBase}/admin/trust-safety/payment-review/queue`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setReviewQueue)
      .catch(() => {});
    fetch(`${apiBase}/admin/trust-safety/agreement-versions/current`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((v) => setCurrentVersion(v.version))
      .catch(() => {});
  }

  useEffect(load, [apiBase]);

  async function decideReview(storeId: string, decision: "approve" | "reject") {
    await fetch(`${apiBase}/admin/trust-safety/payment-review/${storeId}/${decision}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    load();
  }

  async function publishVersion(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${apiBase}/admin/trust-safety/agreement-versions`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ version: newVersion }),
    });
    setNewVersion("");
    load();
  }

  return (
    <main>
      <h1>Trust &amp; Safety (bare view - no design pass yet)</h1>

      <h2>Payment-instrument review queue (FR-30.2)</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Store</th>
            <th>Bank title</th>
            <th>JazzCash title</th>
            <th>Easypaisa title</th>
            <th>Status</th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {reviewQueue.map((item) => (
            <tr key={item.storeId}>
              <td>{item.store?.name ?? item.storeId}</td>
              <td>{item.bankAccountTitle}</td>
              <td>{item.jazzcashAccountTitle}</td>
              <td>{item.easypaisaAccountTitle}</td>
              <td>{item.nameConsistencyStatus}</td>
              <td>
                <button onClick={() => decideReview(item.storeId, "approve")}>Approve</button>{" "}
                <button onClick={() => decideReview(item.storeId, "reject")}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Cancellation-rate flags (FR-6.19)</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Seller</th>
            <th>Total orders</th>
            <th>Cancelled</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {cancellationRate.map((f) => (
            <tr key={f.sellerId}>
              <td>{f.sellerId}</td>
              <td>{f.totalOrders}</td>
              <td>{f.matchingOrders}</td>
              <td>{f.ratePercent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Pending-forever-rate flags (FR-6.19)</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Seller</th>
            <th>Total orders</th>
            <th>Stuck pending</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {pendingForeverRate.map((f) => (
            <tr key={f.sellerId}>
              <td>{f.sellerId}</td>
              <td>{f.totalOrders}</td>
              <td>{f.matchingOrders}</td>
              <td>{f.ratePercent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Signup-velocity flags (FR-29.3)</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>IP address</th>
            <th>Signup count</th>
          </tr>
        </thead>
        <tbody>
          {signupVelocity.map((f) => (
            <tr key={f.ipAddress}>
              <td>{f.ipAddress}</td>
              <td>{f.signupCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Bypass-attempt flags (FR-29.3)</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Seller</th>
            <th>Attempt count</th>
          </tr>
        </thead>
        <tbody>
          {bypassAttempts.map((f) => (
            <tr key={f.sellerId}>
              <td>{f.sellerId}</td>
              <td>{f.attemptCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Seller Agreement version (FR-29.1)</h2>
      <p>Current version: {currentVersion}</p>
      <form onSubmit={publishVersion}>
        <input placeholder="New version, e.g. 1.1" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} required />
        <button type="submit">Publish new version</button>
      </form>
    </main>
  );
}
