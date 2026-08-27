"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Textarea } from "@/components/ui/Field";

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
 * Phase 6d (Admin Terminal re-skin) - SRS §5.35's Verified Store audit
 * queue (FR-35.2) + drift-triggered re-review queue (FR-35.5), restyled
 * onto DashCard. Every eligibility criterion and action preserved: approve/
 * reject an application, clear/revoke a re-review flag (reason-required).
 * Also switched from hand-rolled fetch to adminApi.
 */
export default function AdminVerificationPage() {
  const [queue, setQueue] = useState<Application[]>([]);
  const [reReview, setReReview] = useState<ReReviewStore[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    adminApi.get<Application[]>("/admin/verification/applications").then(setQueue).catch(() => {});
    adminApi.get<ReReviewStore[]>("/admin/verification/re-review").then(setReReview).catch(() => {});
  }

  useEffect(load, []);

  async function decide(applicationId: string, decision: "approve" | "reject") {
    await adminApi.post(`/admin/verification/applications/${applicationId}/${decision}`, { notes: notes[applicationId] });
    load();
  }

  async function clearReReview(storeId: string) {
    await adminApi.post(`/admin/verification/stores/${storeId}/re-review/clear`, { notes: notes[storeId] });
    load();
  }

  /** Confirming a flagged re-review as "revoke" is the same standing revoke action FR-35.5 gives admins any time - it requires a reason. */
  async function confirmRevoke(storeId: string) {
    setError(null);
    const reason = notes[storeId]?.trim();
    if (!reason) {
      setError("Enter a reason before revoking.");
      return;
    }
    await adminApi.post(`/admin/verification/stores/${storeId}/revoke`, { notes: reason });
    load();
  }

  return (
    <div>
      <PageHeader title="Verified Store Program" description="Mandatory admin audit queue - approving is never automatic, even when every criterion passed." />

      {error && <Alert tone="danger">{error}</Alert>}

      <DashCard className="mb-4">
        <DashCardHeader title="Pending applications" />
        {queue.length === 0 ? (
          <EmptyState title="No applications pending review" description="Verified Store applications will show up here." />
        ) : (
          <div className="space-y-4">
            {queue.map((app) => (
              <div key={app.id} className="rounded-md border border-border p-4">
                <p className="text-sm font-medium text-ink">
                  {app.store.name} <span className="font-normal text-ink-muted">({app.store.slug}) · {app.seller.businessName}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Fee: Rs. {Number(app.feeAmount).toFixed(2)} · applied {new Date(app.createdAt).toLocaleString()}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {app.eligibilitySnapshot.criteria.map((c) => (
                    <li key={c.key} className={c.pass ? "text-success" : "text-danger"}>
                      {c.pass ? "✓" : "✗"} <span className="text-ink">{c.label}</span> <span className="text-ink-muted">- {c.detail}</span>
                    </li>
                  ))}
                </ul>
                <Textarea
                  placeholder="Decision notes (optional)"
                  value={notes[app.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [app.id]: e.target.value }))}
                  className="mt-2"
                  rows={2}
                />
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => decide(app.id, "approve")}>
                    Approve
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => decide(app.id, "reject")}>
                    Reject (refunds fee)
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashCard>

      <DashCard>
        <DashCardHeader title="Flagged for re-review" />
        {reReview.length === 0 ? (
          <EmptyState title="No verified stores currently flagged" description="Drift-triggered re-review flags will show up here." />
        ) : (
          <div className="space-y-4">
            {reReview.map((store) => (
              <div key={store.id} className="rounded-md border border-border p-4">
                <p className="text-sm font-medium text-ink">
                  {store.name} <span className="font-normal text-ink-muted">({store.slug}) · flagged {new Date(store.reReviewFlaggedAt).toLocaleString()}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">Reason: {store.reReviewReason}</p>
                <Textarea
                  placeholder="Notes (required to revoke)"
                  value={notes[store.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [store.id]: e.target.value }))}
                  className="mt-2"
                  rows={2}
                />
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => clearReReview(store.id)}>
                    Clear - keep verified
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => confirmRevoke(store.id)}>
                    Confirm - revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashCard>
    </div>
  );
}
