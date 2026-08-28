"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { adminApi, AdminApiError } from "@/lib/admin-api";

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

interface ProviderHealthRollup {
  provider: string;
  verifiedCount: number;
  failedCount: number;
  successRatePercent: number | null;
  lastVerifiedAt: string | null;
  lastFailedAt: string | null;
}

interface SystemStatus {
  db: boolean;
  redis: boolean;
  objectStorage: boolean;
  queues: QueueStatus[];
  email: { provider: string; deliveryFailures: string };
  backups: string;
  paymentGatewayHealth: ProviderHealthRollup[];
}

function ServiceRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <span className="flex items-center gap-2">
        {detail && <span className="text-ink-muted">{detail}</span>}
        <Badge tone={ok ? "success" : "danger"} dot>
          {ok ? "OK" : "DOWN"}
        </Badge>
      </span>
    </div>
  );
}

/**
 * Phase 6b (Admin Terminal re-skin) - Module 25 P1's live infra health page,
 * restyled onto DashCard. Deepened, not just restyled: `paymentGatewayHealth`
 * (Module 67's per-provider verified/failed rollup) was already computed and
 * returned by getStatus() but never rendered anywhere on the admin side
 * (docs/ui-feature-inventory.md §11's disclosed gap) - now a real card here,
 * since this is precisely the page whose job that is.
 */
export default function AdminSystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    adminApi
      .get<SystemStatus>("/admin/system-status")
      .then(setStatus)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load system status."));
  }

  useEffect(load, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!status) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="System status" description="Live infrastructure health: database, cache, object storage, background job queues, and payment gateway reliability." />

      <div className="grid gap-4 lg:grid-cols-2">
        <DashCard>
          <DashCardHeader title="Core services" />
          <div className="divide-y divide-border">
            <ServiceRow label="Database" ok={status.db} />
            <ServiceRow label="Redis" ok={status.redis} />
            <ServiceRow label="Object storage" ok={status.objectStorage} />
            <ServiceRow label="Email" ok detail={`${status.email.provider} · failures: ${status.email.deliveryFailures}`} />
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="font-medium text-ink">Backups</span>
              <span className="text-ink-muted">{status.backups}</span>
            </div>
          </div>
        </DashCard>

        <DashCard>
          <DashCardHeader title="Payment gateway health" description="Module 67 - platform-wide, per-provider verify success rate." />
          <Reveal className="divide-y divide-border" stagger={0.04}>
            {status.paymentGatewayHealth.map((p) => (
              <div key={p.provider} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="font-medium capitalize text-ink">{p.provider}</span>
                <span className="flex items-center gap-2">
                  <span className="text-ink-muted">
                    {p.verifiedCount} ok / {p.failedCount} failed
                  </span>
                  <Badge tone={p.successRatePercent === null ? "neutral" : p.successRatePercent >= 90 ? "success" : "danger"}>
                    {p.successRatePercent === null ? "no data" : `${p.successRatePercent.toFixed(0)}%`}
                  </Badge>
                </span>
              </div>
            ))}
          </Reveal>
        </DashCard>
      </div>

      <Reveal className="mt-4">
        <DashCard>
          <DashCardHeader title="Background job queues" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-4">Queue</th>
                  <th className="py-2 pr-4">Waiting</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Delayed</th>
                  <th className="py-2 pr-4">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {status.queues.map((q) => (
                  <tr key={q.name}>
                    <td className="py-2 pr-4 font-medium text-ink">{q.name}</td>
                    <td className="py-2 pr-4 tabular-nums text-ink-muted">{q.waiting}</td>
                    <td className="py-2 pr-4 tabular-nums text-ink-muted">{q.active}</td>
                    <td className="py-2 pr-4 tabular-nums text-ink-muted">{q.delayed}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {q.failed > 0 ? <span className="font-semibold text-danger">{q.failed}</span> : <span className="text-ink-muted">{q.failed}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashCard>
      </Reveal>
    </div>
  );
}
