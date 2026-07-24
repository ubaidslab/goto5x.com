"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";

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
 * Module 25 P1 (SRS §5.33 FR-33.7/FR-33.11) - the Creator program's
 * content-link verification queue, API-only before this module. Verifying
 * computes and posts the reward (program-reward.service.ts's verify());
 * rejecting pays nothing. Bare functional view (no design pass yet).
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
    try {
      await adminApi.post(`/admin/growth-programs/content-submissions/${id}/${action}`, { notes: notes[id] || undefined });
      load();
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : `Couldn't ${action} this submission.`);
    }
  }

  if (error) return <main>{error}</main>;
  if (!queue) return <main>Loading...</main>;

  return (
    <main>
      <h1>Growth programs - content submissions (bare view - no design pass yet)</h1>
      <p>Verify a Creator's reported content link/views to compute and post the reward, or reject it (pays nothing).</p>

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Participant</th>
            <th>Platform</th>
            <th>Content</th>
            <th>Reported views</th>
            <th>Status</th>
            <th>Reward</th>
            <th>Submitted</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((s) => (
            <tr key={s.id}>
              <td>{s.participantId}</td>
              <td>{s.platform}</td>
              <td>
                <a href={s.contentUrl} target="_blank" rel="noreferrer">
                  {s.contentUrl}
                </a>
              </td>
              <td>{s.reportedViews.toLocaleString()}</td>
              <td>{s.status}</td>
              <td>{s.rewardAmount ?? "-"}</td>
              <td>{new Date(s.createdAt).toLocaleString()}</td>
              <td>
                <input
                  value={notes[s.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  placeholder="Decision notes"
                />
              </td>
              <td>
                <button onClick={() => decide(s.id, "verify")}>Verify</button>{" "}
                <button onClick={() => decide(s.id, "reject")}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
