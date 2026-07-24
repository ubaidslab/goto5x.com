"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

interface SystemStatus {
  db: boolean;
  redis: boolean;
  objectStorage: boolean;
  queues: QueueStatus[];
  email: { provider: string; deliveryFailures: string };
  backups: string;
}

/**
 * Module 25 P1 - the system status page, API-only before this module
 * (genuinely new instrumentation - see admin-system-status.service.ts).
 * The founder explicitly authorized a stub "backups: not yet configured"
 * line until OPS hardening lands, and email delivery-failure tracking is
 * disclosed as not-yet-real rather than faked. Bare functional view (no
 * design pass yet).
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

  if (error) return <main>{error}</main>;
  if (!status) return <main>Loading...</main>;

  return (
    <main>
      <h1>System status (bare view - no design pass yet)</h1>
      <p>Live infrastructure health: database, cache, object storage, and background job queue depths.</p>

      <h2>Core services</h2>
      <ul>
        <li>Database: {status.db ? "ok" : "DOWN"}</li>
        <li>Redis: {status.redis ? "ok" : "DOWN"}</li>
        <li>Object storage: {status.objectStorage ? "ok" : "DOWN"}</li>
        <li>Email: provider = {status.email.provider} - delivery failures: {status.email.deliveryFailures}</li>
        <li>Backups: {status.backups}</li>
      </ul>

      <h2>Background job queues</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Queue</th>
            <th>Waiting</th>
            <th>Active</th>
            <th>Delayed</th>
            <th>Failed</th>
          </tr>
        </thead>
        <tbody>
          {status.queues.map((q) => (
            <tr key={q.name}>
              <td>{q.name}</td>
              <td>{q.waiting}</td>
              <td>{q.active}</td>
              <td>{q.delayed}</td>
              <td style={q.failed > 0 ? { color: "crimson", fontWeight: "bold" } : undefined}>{q.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
