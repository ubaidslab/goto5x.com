"use client";

import { useEffect, useState } from "react";

interface Invoice {
  id: string;
  invoiceType: "commission" | "plan_subscription" | "group_sponsorship";
  totalAmount: string;
  currency: string;
  status: "pending" | "paid" | "overdue";
  dueDate: string;
  paidAt: string | null;
  seller: { businessName: string };
}

/**
 * SRS §5.6c/FR-6.16-6.18 - manual commission-invoice payment verification,
 * the admin-side screen this module builds (the backend/generation job
 * already existed from Module 11). Bare view (no design pass yet), same
 * precedent as every other new admin screen.
 */
export default function AdminInvoicesPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [waiveSellerId, setWaiveSellerId] = useState("");
  const [waiveOrderId, setWaiveOrderId] = useState("");
  const [waiveAmount, setWaiveAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  function load() {
    fetch(`${apiBase}/admin/invoices`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setInvoices)
      .catch(() => setInvoices([]));
  }

  useEffect(load, [apiBase]);

  async function markPaid(invoiceId: string) {
    setError(null);
    const res = await fetch(`${apiBase}/admin/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? "Couldn't mark that invoice paid.");
      return;
    }
    load();
  }

  async function waiveCommission(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${apiBase}/admin/invoices/waive-commission`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sellerId: waiveSellerId, orderId: waiveOrderId, amount: Number(waiveAmount) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? "Couldn't waive that commission.");
      return;
    }
    setWaiveSellerId("");
    setWaiveOrderId("");
    setWaiveAmount("");
    load();
  }

  if (!invoices) return <p>Loading...</p>;

  return (
    <main>
      <h1>Invoices - payment verification (bare view - no design pass yet)</h1>
      <p>Commission, plan-subscription, and team-sponsorship invoices - mark manual payments verified, or waive a disputed commission.</p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Seller</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Due</th>
            <th>Paid at</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.seller.businessName}</td>
              <td>{inv.invoiceType}</td>
              <td>
                {inv.currency} {inv.totalAmount}
              </td>
              <td>{inv.status}</td>
              <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
              <td>{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "-"}</td>
              <td>{inv.status !== "paid" && <button onClick={() => markPaid(inv.id)}>Mark paid</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Waive a disputed commission</h2>
      <form onSubmit={waiveCommission}>
        <p>
          <label>
            Seller ID <input value={waiveSellerId} onChange={(e) => setWaiveSellerId(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Order ID <input value={waiveOrderId} onChange={(e) => setWaiveOrderId(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Amount <input type="number" min={0} step="0.01" value={waiveAmount} onChange={(e) => setWaiveAmount(e.target.value)} required />
          </label>
        </p>
        <button type="submit">Waive commission</button>
      </form>
    </main>
  );
}
