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
import { Reveal } from "@/components/motion/Reveal";

interface Participant {
  id: string;
  sellerId: string;
  programType: string;
  status: string;
  referralCode: string | null;
  appliedAt: string;
  decidedAt: string | null;
  decisionNotes: string | null;
}

/**
 * Phase 6e (Admin Terminal re-skin) - SRS §5.33/FR-33.11's Growth & Partner
 * Programs application queue, restyled onto DashCard. Every action
 * preserved: approve/reject with decision notes. Suspend/terminate for an
 * already-approved participant stays on the Seller-360 page, unchanged.
 */
export default function AdminGrowthApplicationsPage() {
  const [queue, setQueue] = useState<Participant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  function load() {
    adminApi
      .get<Participant[]>("/admin/growth-programs/applications/queue")
      .then(setQueue)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load the queue."));
  }

  useEffect(load, []);

  async function decide(id: string, action: "approve" | "reject") {
    setError(null);
    try {
      await adminApi.post(`/admin/growth-programs/applications/${id}/${action}`, { notes: notes[id] || undefined });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : `Couldn't ${action} this application.`);
    }
  }

  if (error && !queue) return <Alert tone="danger">{error}</Alert>;
  if (!queue) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Growth programs - applications"
        description="Approve or reject a pending application to an Ambassador/Referral/Creator program. Suspending or terminating an already-approved participant is done from that seller's 360° page."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {queue.length === 0 ? (
        <DashCard>
          <EmptyState title="Nothing pending" description="Program applications will show up here." />
        </DashCard>
      ) : (
        <DashCard className="divide-y divide-border">
          <Reveal stagger={0.04}>
          {queue.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {p.sellerId.slice(0, 8)} <Badge tone="neutral">{p.programType}</Badge>
                  {p.referralCode && <span className="ml-1 text-xs text-ink-muted">({p.referralCode})</span>}
                </p>
                <p className="text-xs text-ink-muted">Applied {new Date(p.appliedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-48"
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                  placeholder="Decision notes"
                />
                <Button variant="secondary" size="sm" onClick={() => decide(p.id, "approve")}>
                  Approve
                </Button>
                <Button variant="danger" size="sm" onClick={() => decide(p.id, "reject")}>
                  Reject
                </Button>
              </div>
            </div>
          ))}
          </Reveal>
        </DashCard>
      )}
    </div>
  );
}
