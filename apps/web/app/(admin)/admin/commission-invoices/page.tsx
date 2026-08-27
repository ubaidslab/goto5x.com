"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

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

const statusTone: Record<Invoice["status"], "warning" | "success" | "danger"> = {
  pending: "warning",
  paid: "success",
  overdue: "danger",
};

/**
 * Phase 6c (Admin Terminal re-skin) - Module 25 P1's commission/group-
 * sponsorship invoice list, restyled onto DashCard. Every action preserved:
 * mark-paid per invoice, waive a disputed commission line.
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
    setError(null);
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
      setError(err instanceof AdminApiError ? err.message : "Couldn't mark this invoice paid.");
    }
  }

  async function waiveCommission(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      setError(err instanceof AdminApiError ? err.message : "Couldn't waive this commission.");
    }
  }

  if (error && !invoices) return <Alert tone="danger">{error}</Alert>;
  if (!invoices) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Commission invoices"
        description="Every seller's monthly commission/group-sponsorship invoice - mark a manual payment as verified, or waive a disputed commission line."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <DashCard className="mb-4 divide-y divide-border">
        {invoices.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium text-ink">
                {i.seller?.businessName ?? i.sellerId} <span className="font-normal text-ink-muted">· {i.invoiceType}</span>
              </p>
              <p className="text-xs text-ink-muted">
                {new Date(i.periodStart).toLocaleDateString()} - {new Date(i.periodEnd).toLocaleDateString()} · due {new Date(i.dueDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm tabular-nums text-ink">
                {i.currency} {i.totalAmount}
              </span>
              <Badge tone={statusTone[i.status]}>{i.status}</Badge>
              {i.status !== "paid" && (
                <Button variant="secondary" size="sm" onClick={() => markPaid(i)}>
                  Mark paid
                </Button>
              )}
            </div>
          </div>
        ))}
      </DashCard>

      <DashCard className="max-w-xl">
        <DashCardHeader title="Waive a commission line" />
        <form onSubmit={waiveCommission} className="space-y-3">
          <Field label="Seller ID">
            <Input value={waiveSellerId} onChange={(e) => setWaiveSellerId(e.target.value)} required />
          </Field>
          <Field label="Order ID">
            <Input value={waiveOrderId} onChange={(e) => setWaiveOrderId(e.target.value)} required />
          </Field>
          <Field label="Amount">
            <Input type="number" min={0} step="0.01" value={waiveAmount} onChange={(e) => setWaiveAmount(e.target.value)} required />
          </Field>
          <Button type="submit" variant="danger">
            Waive
          </Button>
        </form>
      </DashCard>
    </div>
  );
}
