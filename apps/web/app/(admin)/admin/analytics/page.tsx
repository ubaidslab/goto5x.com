"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { CurrencyBreakdown } from "@/components/ui/CurrencyBreakdown";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { adminApi } from "@/lib/admin-api";

interface CurrencyAmount {
  currency: string;
  amount: number;
}

interface Analytics {
  gmvByCurrency: CurrencyAmount[];
  revenueByCurrency: CurrencyAmount[];
  commissionEarnedByCurrency: CurrencyAmount[];
  activeStoreCount: number;
  topSellers: { sellerId: string; businessName: string | null; commissionEarned: number }[];
}

interface UnitEconomics {
  storeCount: number;
  totalCommission: number;
  monthlyInfraCost: number;
  breakEven: number;
}

interface SalesBucketPoint {
  bucketStart: string;
  orderCount: number;
  revenue: number;
}

type FunnelStageName = "signed_up" | "store_created" | "first_product_listed" | "published" | "first_sale";

interface FunnelStage {
  stage: FunnelStageName;
  count: number;
  dropOffFromPrevious: number | null;
}

interface StuckSeller {
  sellerId: string;
  businessName: string;
  stage: FunnelStageName;
  daysAtStage: number;
}

interface SellerFunnel {
  stages: FunnelStage[];
  stuckSellers: StuckSeller[];
}

const FUNNEL_STAGE_LABEL: Record<FunnelStageName, string> = {
  signed_up: "Signed up",
  store_created: "Store created",
  first_product_listed: "First product listed",
  published: "Published",
  first_sale: "First sale",
};

/**
 * Phase 6b (Admin Terminal re-skin) - FR-8.10 (real-time analytics) +
 * FR-23.4 (unit economics), same two data sources, restyled onto DashCard.
 * Every metric row preserved.
 *
 * SRS FR-8.19 (Module 98, founder batch B16) - date-range granularity,
 * mirroring the seller-facing Analytics page's From/To + day/week/month
 * pattern exactly. Unlike that page, clearing the range here means
 * **all-time** (this endpoint's own long-standing default), not 30 days -
 * admin's snapshot KPIs have always been cumulative since launch, so the
 * "reset" state has to match that, not silently narrow it to a month.
 */
export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [unitEconomics, setUnitEconomics] = useState<UnitEconomics | null>(null);
  const [salesOverTime, setSalesOverTime] = useState<SalesBucketPoint[] | null>(null);
  const [funnel, setFunnel] = useState<SellerFunnel | null>(null);
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  useEffect(() => {
    const range = rangeStart && rangeEnd ? `?start=${rangeStart}&end=${rangeEnd}` : "";
    adminApi.get<Analytics>(`/admin/analytics${range}`).then(setAnalytics).catch(() => {});
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    adminApi.get<UnitEconomics>("/admin/unit-economics").then(setUnitEconomics).catch(() => {});
  }, []);

  useEffect(() => {
    adminApi.get<SellerFunnel>("/admin/analytics/seller-funnel").then(setFunnel).catch(() => {});
  }, []);

  useEffect(() => {
    const range = rangeStart && rangeEnd ? `&start=${rangeStart}&end=${rangeEnd}` : "";
    adminApi.get<SalesBucketPoint[]>(`/admin/analytics/sales-over-time?bucket=${bucket}${range}`).then(setSalesOverTime).catch(() => {});
  }, [bucket, rangeStart, rangeEnd]);

  if (!analytics || !unitEconomics || !salesOverTime || !funnel) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Platform analytics" description="Real-time GMV, revenue, and unit economics - computed live against transactional data." />

      <DashCard className="mb-6">
        <DashCardHeader
          title="Date range"
          description={rangeStart && rangeEnd ? "GMV, revenue, and top sellers below are scoped to this range." : "Showing all-time (since launch). Active store count is always live, regardless of range."}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Field label="From">
                <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} max={rangeEnd || undefined} />
              </Field>
              <Field label="To">
                <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} min={rangeStart || undefined} />
              </Field>
              {(rangeStart || rangeEnd) && (
                <button
                  onClick={() => {
                    setRangeStart("");
                    setRangeEnd("");
                  }}
                  className="text-xs text-ink-muted underline hover:text-ink"
                >
                  Reset to all-time
                </button>
              )}
            </div>
          }
        />
      </DashCard>

      <Reveal className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" stagger={0.06}>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">GMV</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            <CurrencyBreakdown amounts={analytics.gmvByCurrency} />
          </p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Revenue (commission)</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            <CurrencyBreakdown amounts={analytics.revenueByCurrency} />
          </p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Active stores (live)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{analytics.activeStoreCount}</p>
        </DashCard>
        <DashCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Break-even</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{unitEconomics.breakEven.toFixed(2)}</p>
        </DashCard>
      </Reveal>

      <DashCard className="mb-4">
        <DashCardHeader
          title="Sales over time"
          description="FR-8.19"
          action={
            <div className="flex gap-1">
              {(["day", "week", "month"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBucket(b)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-smooth-fast ${
                    bucket === b ? "bg-accent text-white" : "text-ink-muted hover:bg-canvas"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          }
        />
        {salesOverTime.length === 0 || salesOverTime.every((p) => p.orderCount === 0) ? (
          <p className="py-8 text-center text-sm text-ink-muted">No confirmed sales in this period yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={salesOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="bucketStart" tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
              <Tooltip
                formatter={(value: unknown) => [Number(value ?? 0).toFixed(2), "Revenue"]}
                contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </DashCard>

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

      <DashCard className="mt-4">
        <DashCardHeader
          title="Seller health funnel"
          description="SRS §5.6k/FR-6.46 - signup -> store created -> first product listed -> published -> first sale, computed live (no separate tracking table)."
        />
        {funnel.stages.every((s) => s.count === 0) ? (
          <p className="py-8 text-center text-sm text-ink-muted">No sellers yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={funnel.stages.map((s) => ({ name: FUNNEL_STAGE_LABEL[s.stage], count: s.count }))}
              layout="vertical"
              margin={{ left: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
              <Tooltip
                formatter={(value: unknown) => [String(value ?? 0), "Sellers"]}
                contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 12 }}
              />
              <Bar dataKey="count" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-ink-muted">
          {funnel.stages.map((s) => (
            <span key={s.stage}>
              {FUNNEL_STAGE_LABEL[s.stage]}: <span className="font-medium text-ink">{s.count}</span>
              {s.dropOffFromPrevious !== null && s.dropOffFromPrevious > 0 && (
                <span className="text-danger"> (-{s.dropOffFromPrevious})</span>
              )}
            </span>
          ))}
        </div>
      </DashCard>

      <DashCard className="mt-4">
        <DashCardHeader
          title="Stuck sellers"
          description="Sellers who haven't advanced past their current stage in longer than growth.funnel_stuck_days - sorted longest-stuck first."
        />
        {funnel.stuckSellers.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">No sellers currently stuck past the threshold.</p>
        ) : (
          <div className="divide-y divide-border">
            {funnel.stuckSellers.map((s) => (
              <div key={s.sellerId} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-ink">{s.businessName}</span>
                <span className="text-ink-muted">
                  Stuck at <span className="font-medium text-ink">{FUNNEL_STAGE_LABEL[s.stage]}</span> for{" "}
                  <span className="font-medium tabular-nums text-ink">{s.daysAtStage}</span> day{s.daysAtStage === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        )}
      </DashCard>
    </div>
  );
}
