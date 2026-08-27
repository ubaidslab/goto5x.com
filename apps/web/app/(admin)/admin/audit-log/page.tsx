"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { DashCard } from "@/components/dashboard/ui/DashCard";
import { Field, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

interface AuditLogRow {
  id: string;
  adminUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  impersonationSessionId: string | null;
  createdAt: string;
}

/**
 * Phase 6f (Admin Terminal re-skin) - the read-only audit log viewer,
 * restyled onto DashCard. No write actions existed before (insert-only
 * table) and none are added now. Every column preserved, including the
 * expandable before/after JSON diff.
 */
export default function AdminAuditLogPage() {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);

  function load() {
    adminApi
      .get<AuditLogRow[]>(`/admin/audit-logs?limit=${limit}`)
      .then(setRows)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load the audit log."));
  }

  useEffect(load, [limit]);

  if (error && !rows) return <Alert tone="danger">{error}</Alert>;
  if (!rows) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Audit log" description="Every admin action taken on this platform, insert-only (no admin, including this one, can edit or delete a row)." />

      <div className="mb-4 max-w-xs">
        <Field label="Show last">
          <Select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </Select>
        </Field>
      </div>

      <DashCard className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.id} className="py-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-ink">
                <span className="text-ink-muted">{new Date(r.createdAt).toLocaleString()}</span> · {r.adminUserId ?? "system"} ·{" "}
                <span className="font-medium">{r.action}</span> · {r.targetType} {r.targetId && `(${r.targetId})`}
              </span>
              {r.impersonationSessionId && <span className="text-xs text-ink-faint">session {r.impersonationSessionId.slice(0, 8)}</span>}
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-accent">view before/after</summary>
              <pre className="mt-1 overflow-x-auto rounded-md bg-canvas p-2 text-xs text-ink-muted">
                {JSON.stringify({ before: r.beforeValue, after: r.afterValue }, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </DashCard>
    </div>
  );
}
