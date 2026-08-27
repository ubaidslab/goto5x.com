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

interface Submission {
  id: string;
  participantId: string;
  platform: string;
  contentUrl: string;
  reportedViews: number;
  status: string;
  rewardAmount: string | null;
  createdAt: string;
}

/**
 * Phase 6e (Admin Terminal re-skin) - SRS §5.33/FR-33.7/FR-33.11's Creator
 * program content-link verification queue, restyled onto DashCard. Every
 * action preserved: verify (computes + posts reward) or reject (pays
 * nothing), with decision notes.
 */
export default function AdminGrowthContentSubmissionsPage() {
  const [queue, setQueue] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  function load() {
    adminApi
      .get<Submission[]>("/admin/growth-programs/content-submissions/queue")
      .then(setQueue)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load the queue."));
  }

  useEffect(load, []);

  async function decide(id: string, action: "verify" | "reject") {
    setError(null);
    try {
      await adminApi.post(`/admin/growth-programs/content-submissions/${id}/${action}`, { notes: notes[id] || undefined });
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : `Couldn't ${action} this submission.`);
    }
  }

  if (error && !queue) return <Alert tone="danger">{error}</Alert>;
  if (!queue) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Growth programs - content submissions"
        description="Verify a Creator's reported content link/views to compute and post the reward, or reject it (pays nothing)."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {queue.length === 0 ? (
        <DashCard>
          <EmptyState title="Nothing pending" description="Creator content submissions will show up here." />
        </DashCard>
      ) : (
        <DashCard className="divide-y divide-border">
          {queue.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {s.participantId.slice(0, 8)} <Badge tone="neutral">{s.platform}</Badge>
                  </p>
                  <p className="text-xs text-ink-muted">
                    <a href={s.contentUrl} target="_blank" rel="noreferrer" className="text-accent hover:opacity-80">
                      {s.contentUrl}
                    </a>{" "}
                    · {s.reportedViews.toLocaleString()} views · {new Date(s.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs text-ink-muted">
                  {s.status} {s.rewardAmount && `· reward: ${s.rewardAmount}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-56"
                  value={notes[s.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  placeholder="Decision notes"
                />
                <Button variant="secondary" size="sm" onClick={() => decide(s.id, "verify")}>
                  Verify
                </Button>
                <Button variant="danger" size="sm" onClick={() => decide(s.id, "reject")}>
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </DashCard>
      )}
    </div>
  );
}
