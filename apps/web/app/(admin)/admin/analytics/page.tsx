"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { adminApi } from "@/lib/admin-api";

interface Analytics {
  gmv: number;
  revenue: number;
  commissionEarned: number;
  activeStoreCount: number;
  topSellers: { sellerId: string; businessName: string | null; commissionEarned: number }[];
}

interface UnitEconomics {
  storeCount: number;
  totalCommission: number;
  monthlyInfraCost: number;
  breakEven: number;
}

/**
 * Phase 6b (Admin Terminal re-skin) - FR-8.10 (real-time analytics) +
 * FR-23.4 (unit economics), same two data sources, restyled onto DashCard.
 * Every metric row preserved.
 */
export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [unitEconomics, setUnitEconomics] = useState<UnitEconomics | null>(null);

  useEffect(() => {
    adminApi.get<Analytics>("/admin/analytics").then(setAnalytics).catch(() => {});
    adminApi.get<UnitEconomics>("/admin/unit-economics").then(setUnitEconomics).catch(() => {});
  }, []);

  if (!analytics || !unitEconomics) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Platform analytics" description="Real-time GMV, revenue, and unit economics - computed live against transactional data." />

      <Reveal className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" stagger={0.06}>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">GMV</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{analytics.gmv.toFixed(2)}</p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Revenue (commission)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{analytics.revenue.toFixed(2)}</p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Active stores</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{analytics.activeStoreCount}</p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Break-even</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{unitEconomics.breakEven.toFixed(2)}</p>
        </DashCard>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashCard>
          <DashCardHeader title="Top sellers by commission earned" />
          {analytics.topSellers.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">No commission earned yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, analytics.topSellers.length * 36)}>
              <BarChart
                data={analytics.topSellers.map((s) => ({ name: s.businessName ?? s.sellerId, commissionEarned: s.commissionEarned }))}
                layout="vertical"
                margin={{ left: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
                <Tooltip
                  formatter={(value: unknown) => [Number(value ?? 0).toFixed(2), "Commission earned"]}
                  contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 12 }}
                />
                <Bar dataKey="commissionEarned" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashCard>

        <DashCard>
          <DashCardHeader title="Unit economics" description="FR-23.4" />
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-ink-muted">Total stores</span>
              <span className="font-medium tabular-nums text-ink">{unitEconomics.storeCount}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-ink-muted">Total commission earned</span>
              <span className="font-medium tabular-nums text-ink">{unitEconomics.totalCommission.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-ink-muted">Monthly infra cost (admin-entered)</span>
              <span className="font-medium tabular-nums text-ink">{unitEconomics.monthlyInfraCost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-ink-muted">Break-even (commission - infra cost)</span>
              <span className="font-medium tabular-nums text-ink">{unitEconomics.breakEven.toFixed(2)}</span>
            </div>
          </div>
        </DashCard>
      </div>
    </div>
  );
}
