"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/admin-api";

interface QueueCount {
  label: string;
  count: number;
  href: string;
}

interface Overview {
  today: { signups: number; orders: number; gmv: number };
  allTime: { gmv: number; revenue: number; activeStoreCount: number };
  queues: QueueCount[];
  pendingActionCount: number;
}

/**
 * Module 25 (Admin Completion) - the admin HOME page (§14 gap: no page
 * answered "what needs my attention right now" with jump-links to every
 * queue). Bare, functional - no design pass, matching the rest of this
 * admin section.
 */
export default function AdminHomePage() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    adminApi.get<Overview>("/admin/overview").then(setOverview).catch(() => {});
  }, []);

  if (!overview) return <main>Loading...</main>;

  return (
    <main>
      <h1>Admin home</h1>
      <p>Today: {overview.today.signups} signups, {overview.today.orders} orders, PKR {overview.today.gmv.toFixed(2)} GMV.</p>
      <p>All time: PKR {overview.allTime.gmv.toFixed(2)} GMV, PKR {overview.allTime.revenue.toFixed(2)} revenue, {overview.allTime.activeStoreCount} active stores.</p>

      <h2>Needs your attention ({overview.pendingActionCount} total)</h2>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Queue</th>
            <th>Count</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {overview.queues.map((q) => (
            <tr key={q.label}>
              <td>{q.label}</td>
              <td>{q.count}</td>
              <td>
                <Link href={q.href}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
