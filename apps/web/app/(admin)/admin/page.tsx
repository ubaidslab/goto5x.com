"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
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
 * Phase 6b (Admin Terminal re-skin) - same Module 25 data (today/all-time
 * metrics, the full attention-needed queue list), restyled onto the
 * dashboard/admin DashCard kit. Every queue row from the original bare
 * table is preserved - none dropped, none merged away.
 */
export default function AdminHomePage() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    adminApi.get<Overview>("/admin/overview").then(setOverview).catch(() => {});
  }, []);

  if (!overview) return <PageSpinner />;

  const openQueues = overview.queues.filter((q) => q.count > 0);
  const emptyQueues = overview.queues.filter((q) => q.count === 0);

  return (
    <div>
      <PageHeader title="Admin home" description="What needs attention right now, plus platform-wide activity at a glance." />

      <Reveal className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3" stagger={0.06}>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Signups today</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{overview.today.signups}</p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Orders today</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{overview.today.orders}</p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">GMV today</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">PKR {overview.today.gmv.toFixed(2)}</p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">All-time GMV</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">PKR {overview.allTime.gmv.toFixed(2)}</p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">All-time revenue</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">PKR {overview.allTime.revenue.toFixed(2)}</p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Active stores</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{overview.allTime.activeStoreCount}</p>
        </DashCard>
      </Reveal>

      <DashCard>
        <DashCardHeader
          title={`Needs your attention (${overview.pendingActionCount} total)`}
          description="Every platform-wide queue in one place - open items surface first."
        />
        <div className="divide-y divide-border">
          {[...openQueues, ...emptyQueues].map((q) => (
            <Link
              key={q.label}
              href={q.href}
              className="flex items-center justify-between gap-4 py-3 transition-smooth-fast hover:opacity-80"
            >
              <span className="text-sm font-medium text-ink">{q.label}</span>
              <Badge tone={q.count > 0 ? "warning" : "neutral"}>{q.count}</Badge>
            </Link>
          ))}
        </div>
      </DashCard>
    </div>
  );
}
