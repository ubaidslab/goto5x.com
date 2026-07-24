"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";

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
 * Module 25 P1 (SRS §5.33 FR-33.11) - the Growth & Partner Programs
 * application queue, API-only before this module. `listQueue()` only ever
 * returns `pending` rows (program-application.service.ts) - approve/reject
 * are the only decisions reachable from here. Suspending or terminating an
 * already-approved participant is a per-seller action, wired on the
 * seller-360 page instead (its "Growth program participation" section)
 * since this queue has no way to surface a non-pending row. Bare functional
 * view (no design pass yet), same discipline as every other admin screen.
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
    try {
      await adminApi.post(`/admin/growth-programs/applications/${id}/${action}`, { notes: notes[id] || undefined });
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : `Couldn't ${action} this application.`);
    }
  }

  if (error) return <main>{error}</main>;
  if (!queue) return <main>Loading...</main>;

  return (
    <main>
      <h1>Growth programs - applications (bare view - no design pass yet)</h1>
      <p>
        Approve or reject a pending application to an Ambassador/Referral/Creator program. Suspending or terminating
        an already-approved participant is done from that seller's 360° page.
      </p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Seller</th>
            <th>Program</th>
            <th>Status</th>
            <th>Referral code</th>
            <th>Applied</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((p) => (
            <tr key={p.id}>
              <td>{p.sellerId}</td>
              <td>{p.programType}</td>
              <td>{p.status}</td>
              <td>{p.referralCode ?? "-"}</td>
              <td>{new Date(p.appliedAt).toLocaleString()}</td>
              <td>
                <input
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                  placeholder="Decision notes"
                />
              </td>
              <td>
                <button onClick={() => decide(p.id, "approve")}>Approve</button>{" "}
                <button onClick={() => decide(p.id, "reject")}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
