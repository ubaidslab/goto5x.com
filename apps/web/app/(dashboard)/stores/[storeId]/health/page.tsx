"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { api } from "@/lib/dashboard-api";

interface HealthBreakdownInput {
  key: string;
  label: string;
  weight: number;
  fraction: number;
  contribution: number;
  suggestion?: string;
}

interface HealthResponse {
  score: number | null;
  breakdown: HealthBreakdownInput[] | null;
  computedAt: string | null;
}

interface HealthHistoryRow {
  id: string;
  score: number;
  computedAt: string;
}

function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

/**
 * Module 23 (SRS §5.34, FR-34.3) - the current score plus a plain-language
 * breakdown of what's lowering it, per the Simplicity Invariant: no raw
 * weighted-sum math shown here, only the suggestion each low input already
 * carries from the API.
 */
export default function StoreHealthPage({ params }: { params: { storeId: string } }) {
  const [current, setCurrent] = useState<HealthResponse | null>(null);
  const [history, setHistory] = useState<HealthHistoryRow[] | null>(null);

  useEffect(() => {
    api.get<HealthResponse>(`/stores/${params.storeId}/health`).then(setCurrent).catch(() => setCurrent({ score: null, breakdown: null, computedAt: null }));
    api.get<HealthHistoryRow[]>(`/stores/${params.storeId}/health/history`).then(setHistory).catch(() => setHistory([]));
  }, [params.storeId]);

  if (current === null || history === null) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Health Score"
        description="A 0-100 score reflecting how smoothly your store is running - recomputed on a schedule, with a plain-language breakdown of what's holding it back."
      />

      <Card>
        <CardBody>
          {current.score === null ? (
            <p className="text-sm text-ink-muted">Your first score hasn't been computed yet - check back after the next scheduled run.</p>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-4xl font-semibold text-ink">{current.score}</p>
              <Badge tone={scoreTone(current.score)}>{current.score >= 80 ? "Healthy" : current.score >= 50 ? "Needs attention" : "At risk"}</Badge>
              {current.computedAt && (
                <p className="text-xs text-ink-muted">Last computed {new Date(current.computedAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {current.breakdown && current.breakdown.some((i) => i.suggestion) && (
        <Card>
          <CardHeader title="What's lowering your score" />
          <CardBody className="space-y-3">
            {current.breakdown
              .filter((i) => i.suggestion)
              .map((i) => (
                <div key={i.key}>
                  <p className="text-sm font-medium text-ink">{i.label}</p>
                  <p className="text-sm text-ink-muted">{i.suggestion}</p>
                </div>
              ))}
          </CardBody>
        </Card>
      )}

      {current.breakdown && (
        <Card>
          <CardHeader title="Score breakdown" />
          <CardBody className="divide-y divide-border">
            {current.breakdown.map((i) => (
              <div key={i.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-ink">{i.label}</p>
                <p className="text-sm text-ink-muted">{Math.round(i.fraction * 100)}% of full marks</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader title="Recent history" />
          <CardBody className="divide-y divide-border">
            {history.map((row) => (
              <div key={row.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <p className="text-xs text-ink-muted">{new Date(row.computedAt).toLocaleString()}</p>
                <p className="text-sm font-medium text-ink">{row.score}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
