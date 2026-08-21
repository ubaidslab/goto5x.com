"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";

interface Invoice {
  id: string;
  sellerId: string;
  invoiceType: "commission" | "group_sponsorship";
  periodStart: string;
  periodEnd: string;
  totalAmount: string;
  currency: string;
  status: "pending" | "paid" | "overdue";
  dueDate: string;
  paidAt: string | null;
  seller: { businessName: string } | null;
}

/**
 * Module 25 P1 (SRS §5.6c/§5.7 FR-6.17/FR-6.18/FR-7.15) - the real
 * commission/group-sponsorship invoice list, split out from the
 * mislabeled `/admin/invoices` route (that page is Module 20's wallet
 * top-up verification screen, correctly renamed "Wallet top-ups" in the
 * nav - it never showed invoices). This is the founder-required fix:
 * `GET /admin/invoices` (AdminInvoicesController) was already the correct
 * backend endpoint the whole time; only a frontend screen was missing.
 * Bare functional view (no design pass yet).
 */
export default function AdminCommissionInvoicesPage() {
  const confirm = useConfirm();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiveSellerId, setWaiveSellerId] = useState("");
  const [waiveOrderId, setWaiveOrderId] = useState("");
  const [waiveAmount, setWaiveAmount] = useState("");

  function load() {
    adminApi
      .get<Invoice[]>("/admin/invoices")
      .then(setInvoices)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load invoices."));
  }

  useEffect(load, []);

  async function markPaid(invoice: Invoice) {
    const ok = await confirm({
      title: `Mark this invoice paid?`,
      description: `${invoice.seller?.businessName ?? invoice.sellerId} - ${invoice.invoiceType}, ${invoice.currency} ${invoice.totalAmount}. This records the invoice as manually verified paid.`,
      changes: [{ label: "Status", from: invoice.status, to: "paid" }],
      confirmLabel: "Mark paid",
    });
    if (!ok) return;
    try {
      await adminApi.post(`/admin/invoices/${invoice.id}/mark-paid`);
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't mark this invoice paid.");
    }
  }

  async function waiveCommission(e: React.FormEvent) {
    e.preventDefault();
    const ok = await confirm({
      title: "Waive this commission line?",
      description: `Seller ${waiveSellerId}, order ${waiveOrderId}. This permanently removes the commission owed on this order.`,
      changes: [{ label: "Commission owed", from: `PKR ${waiveAmount}`, to: "PKR 0.00 (waived)" }],
      confirmLabel: "Waive",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await adminApi.post("/admin/invoices/waive-commission", {
        sellerId: waiveSellerId,
        orderId: waiveOrderId,
        amount: Number(waiveAmount),
      });
      setWaiveSellerId("");
      setWaiveOrderId("");
      setWaiveAmount("");
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : "Couldn't waive this commission.");
    }
  }

  if (error) return <main>{error}</main>;
  if (!invoices) return <main>Loading...</main>;

  return (
    <main>
      <h1>Commission invoices (bare view - no design pass yet)</h1>
      <p>Every seller's monthly commission/group-sponsorship invoice - mark a manual payment as verified, or waive a disputed commission line.</p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Seller</th>
            <th>Type</th>
            <th>Period</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Due</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id}>
              <td>{i.seller?.businessName ?? i.sellerId}</td>
              <td>{i.invoiceType}</td>
              <td>
                {new Date(i.periodStart).toLocaleDateString()} - {new Date(i.periodEnd).toLocaleDateString()}
              </td>
              <td>
                {i.currency} {i.totalAmount}
              </td>
              <td>{i.status}</td>
              <td>{new Date(i.dueDate).toLocaleDateString()}</td>
              <td>{i.status !== "paid" && <button onClick={() => markPaid(i)}>Mark paid</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Waive a commission line</h2>
      <form onSubmit={waiveCommission}>
        <p>
          <label>
            Seller ID: <input value={waiveSellerId} onChange={(e) => setWaiveSellerId(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Order ID: <input value={waiveOrderId} onChange={(e) => setWaiveOrderId(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Amount: <input type="number" min={0} step="0.01" value={waiveAmount} onChange={(e) => setWaiveAmount(e.target.value)} required />
          </label>
        </p>
        <button type="submit">Waive</button>
      </form>
    </main>
  );
}
