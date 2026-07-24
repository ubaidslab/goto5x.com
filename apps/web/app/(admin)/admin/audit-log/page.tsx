"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";

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
 * Module 25 P1 - a read-only viewer over `admin_audit_logs`, API-only
 * before this module (the table is insert-only by DB grant, so this page
 * has no write actions at all - see audit-log.service.ts). Bare
 * functional view (no design pass yet).
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

  if (error) return <main>{error}</main>;
  if (!rows) return <main>Loading...</main>;

  return (
    <main>
      <h1>Audit log (bare view - no design pass yet)</h1>
      <p>Every admin action taken on this platform, insert-only (no admin, including this one, can edit or delete a row).</p>
      <p>
        <label>
          Show last:{" "}
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </label>
      </p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>When</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Target</th>
            <th>Impersonation session</th>
            <th>Before / after</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
              <td>{r.adminUserId ?? "system"}</td>
              <td>{r.action}</td>
              <td>
                {r.targetType} {r.targetId && `(${r.targetId})`}
              </td>
              <td>{r.impersonationSessionId ?? "-"}</td>
              <td>
                <details>
                  <summary>view</summary>
                  <pre>{JSON.stringify({ before: r.beforeValue, after: r.afterValue }, null, 2)}</pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
