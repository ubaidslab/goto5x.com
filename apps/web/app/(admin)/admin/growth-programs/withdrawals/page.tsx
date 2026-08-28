"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

interface Payout {
  id: string;
  sellerId: string;
  amount: string;
  currency: string;
  status: string;
  requestedAt: string;
  paymentReference: string | null;
}

const statusTone: Record<string, "warning" | "success" | "info" | "danger" | "neutral"> = {
  requested: "warning",
  approved: "info",
  processing: "info",
  paid: "success",
  rejected: "danger",
};

/**
 * Phase 6e (Admin Terminal re-skin) - SRS §5.33/FR-33.9/FR-33.11's growth-
 * program payout approval queue, restyled onto DashCard. Every action
 * preserved: approve/reject (reason-required field), mark processing, mark
 * paid (payment-reference field). Deliberately still separate from Wallet
 * top-ups (disbursement vs. collection).
 */
export default function AdminGrowthWithdrawalsPage() {
  const [queue, setQueue] = useState<Payout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [paymentRef, setPaymentRef] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  function load() {
    adminApi
      .get<Payout[]>("/admin/growth-programs/withdrawals/queue")
      .then(setQueue)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load the queue."));
  }

  useEffect(load, []);

  async function approve(id: string) {
    setError(null);
    setActingId(id);
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/${id}/approve`, { notes: notes[id] || undefined });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't approve this payout.");
    } finally {
      setActingId(null);
    }
  }

  async function markProcessing(id: string) {
    setError(null);
    setActingId(id);
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/${id}/processing`);
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't mark this payout processing.");
    } finally {
      setActingId(null);
    }
  }

  async function markPaid(id: string) {
    setError(null);
    setActingId(id);
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/${id}/paid`, { paymentReference: paymentRef[id] || undefined });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't mark this payout paid.");
    } finally {
      setActingId(null);
    }
  }

  async function reject(id: string) {
    setError(null);
    setActingId(id);
    try {
      await adminApi.post(`/admin/growth-programs/withdrawals/${id}/reject`, { notes: notes[id] || undefined });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't reject this payout.");
    } finally {
      setActingId(null);
    }
  }

  if (error && !queue) return <Alert tone="danger">{error}</Alert>;
  if (!queue) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Growth programs - withdrawals"
        description="Approve, process, mark paid, or reject a program participant's payout request. A clawback is a per-seller action (seller 360°)."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {queue.length === 0 ? (
        <DashCard>
          <EmptyState title="Nothing pending" description="Payout requests will show up here." />
        </DashCard>
      ) : (
        <DashCard className="divide-y divide-border">
          {queue.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {p.sellerId.slice(0, 8)} <span className="tabular-nums text-ink-muted">· {p.currency} {p.amount}</span>
                </p>
                <p className="text-xs text-ink-muted">Requested {new Date(p.requestedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone[p.status] ?? "neutral"}>{p.status}</Badge>
                {p.status === "processing" ? (
                  <Input
                    className="h-8 w-40"
                    value={paymentRef[p.id] ?? ""}
                    onChange={(e) => setPaymentRef((n) => ({ ...n, [p.id]: e.target.value }))}
                    placeholder="Payment reference"
                  />
                ) : (
                  <Input
                    className="h-8 w-40"
                    value={notes[p.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                    placeholder="Decision notes"
                  />
                )}
                {p.status === "requested" && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => approve(p.id)} loading={actingId === p.id} disabled={actingId !== null && actingId !== p.id}>
                      Approve
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => reject(p.id)} loading={actingId === p.id} disabled={actingId !== null && actingId !== p.id}>
                      Reject
                    </Button>
                  </>
                )}
                {p.status === "approved" && (
                  <Button variant="secondary" size="sm" onClick={() => markProcessing(p.id)} loading={actingId === p.id} disabled={actingId !== null && actingId !== p.id}>
                    Mark processing
                  </Button>
                )}
                {p.status === "processing" && (
                  <Button variant="secondary" size="sm" onClick={() => markPaid(p.id)} loading={actingId === p.id} disabled={actingId !== null && actingId !== p.id}>
                    Mark paid
                  </Button>
                )}
              </div>
            </div>
          ))}
        </DashCard>
      )}
    </div>
  );
}
