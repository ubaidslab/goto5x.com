"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert } from "@/components/ui/Alert";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { ApiError, api } from "@/lib/dashboard-api";

interface TopProductRow {
  productId: string;
  productTitle: string;
  units: number;
  revenue: number;
}

interface SalesBucketPoint {
  bucketStart: string;
  orderCount: number;
  revenue: number;
}

interface Overview {
  repeatCustomerRate: number;
  returnRate: number;
  aov: number;
}

interface ReturnRateByProductRow {
  productId: string;
  productTitle: string;
  returnRate: number;
}

interface DealPerformanceRow {
  dealId: string;
  title: string;
  orders: number;
  revenue: number;
  units: number;
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <DashCard>
      <div>
        <div className="flex items-center gap-2 text-ink-muted">
          <Icon className="h-4 w-4" />
          <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        </div>
        <p className="mt-1 text-3xl font-semibold text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      </div>
    </DashCard>
  );
}

/**
 * SRS §5.61/FR-61.1-61.7 (Module 54) - Analytics Depth. Charts, not
 * spreadsheets (Simplicity Invariant §3.13, FR-61.6) - the first charting
 * library in apps/web (recharts). Bare functional UI, same discipline as
 * the P&L page (premium redesign is a later, separate design phase).
 */
export default function AnalyticsPage({ params }: { params: { storeId: string } }) {
  const [topProducts, setTopProducts] = useState<TopProductRow[] | null>(null);
  const [topProductsBy, setTopProductsBy] = useState<"revenue" | "units">("revenue");
  const [salesOverTime, setSalesOverTime] = useState<SalesBucketPoint[] | null>(null);
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [returnRateByProduct, setReturnRateByProduct] = useState<ReturnRateByProductRow[] | null>(null);
  const [dealPerformance, setDealPerformance] = useState<DealPerformanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Founder walkthrough finding (pre-Milestone-A, Phase 0.4) - each catch
  // below used to set only the shared `error` string, never its own
  // resource's state. `loading` (below) requires all five to be non-null,
  // so a single failed endpoint left the page stuck on `PageSpinner`
  // forever - the `error` Alert was rendered, but underneath a full-page
  // spinner that never cleared, easy to miss and functionally identical to
  // "hangs with no visible error." Every catch now also sets a safe
  // fallback, matching the pattern the dashboard Home page's own fetches
  // already used.
  useEffect(() => {
    api
      .get<TopProductRow[]>(`/stores/${params.storeId}/analytics/top-products?by=${topProductsBy}&limit=10`)
      .then(setTopProducts)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't load top products.");
        setTopProducts([]);
      });
  }, [params.storeId, topProductsBy]);

  useEffect(() => {
    const range = rangeStart && rangeEnd ? `&start=${rangeStart}&end=${rangeEnd}` : "";
    api
      .get<SalesBucketPoint[]>(`/stores/${params.storeId}/analytics/sales-over-time?bucket=${bucket}${range}`)
      .then(setSalesOverTime)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't load sales over time.");
        setSalesOverTime([]);
      });
  }, [params.storeId, bucket, rangeStart, rangeEnd]);

  useEffect(() => {
    api
      .get<Overview>(`/stores/${params.storeId}/analytics/overview`)
      .then(setOverview)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't load the analytics overview.");
        setOverview({ repeatCustomerRate: 0, returnRate: 0, aov: 0 });
      });
  }, [params.storeId]);

  useEffect(() => {
    api
      .get<ReturnRateByProductRow[]>(`/stores/${params.storeId}/analytics/return-rate-by-product`)
      .then(setReturnRateByProduct)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't load return rate by product.");
        setReturnRateByProduct([]);
      });
  }, [params.storeId]);

  useEffect(() => {
    api
      .get<DealPerformanceRow[]>(`/stores/${params.storeId}/analytics/deal-performance`)
      .then(setDealPerformance)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't load deal performance.");
        setDealPerformance([]);
      });
  }, [params.storeId]);

  const loading =
    topProducts === null || salesOverTime === null || overview === null || returnRateByProduct === null || dealPerformance === null;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Where your sales actually come from - top products, sales over time, and the numbers a spreadsheet buries."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <PageSpinner />
      ) : (
        <div className="max-w-5xl space-y-6">
          <Reveal stagger={0.08} className="grid gap-4 sm:grid-cols-3">
            <StatTile icon={Users} label="Repeat customers" value={`${overview!.repeatCustomerRate}%`} hint="Ordered more than once" />
            <StatTile icon={RotateCcw} label="Return rate" value={`${overview!.returnRate}%`} hint="Of confirmed orders" />
            <StatTile icon={Wallet} label="Average order value" value={`Rs ${overview!.aov.toLocaleString()}`} />
          </Reveal>

          <Reveal>
          <DashCard>
            <DashCardHeader
              title="Sales over time"
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
                      Reset to last 30 days
                    </button>
                  )}
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
                </div>
              }
            />
            <div>
              {salesOverTime!.length === 0 || salesOverTime!.every((p) => p.orderCount === 0) ? (
                <p className="py-8 text-center text-sm text-ink-muted">No confirmed sales in this period yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={salesOverTime!}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="bucketStart" tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
                    <Tooltip
                      formatter={(value: unknown) => [`Rs ${Number(value ?? 0).toLocaleString()}`, "Revenue"]}
                      contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </DashCard>
          </Reveal>

          <Reveal>
          <DashCard>
            <DashCardHeader
              title="Top products"
              action={
                <div className="flex gap-1">
                  {(["revenue", "units"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setTopProductsBy(m)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-smooth-fast ${
                        topProductsBy === m ? "bg-accent text-white" : "text-ink-muted hover:bg-canvas"
                      }`}
                    >
                      by {m}
                    </button>
                  ))}
                </div>
              }
            />
            <div>
              {topProducts!.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">No confirmed sales yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, topProducts!.length * 36)}>
                  <BarChart data={topProducts!} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
                    <YAxis
                      type="category"
                      dataKey="productTitle"
                      width={140}
                      tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }}
                    />
                    <Tooltip
                      formatter={(value: unknown) =>
                        topProductsBy === "revenue"
                          ? [`Rs ${Number(value ?? 0).toLocaleString()}`, "Revenue"]
                          : [Number(value ?? 0), "Units"]
                      }
                      contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 12 }}
                    />
                    <Bar dataKey={topProductsBy === "revenue" ? "revenue" : "units"} fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </DashCard>
          </Reveal>

          <Reveal>
          <DashCard>
            <DashCardHeader title="Return rate by product" description="Of orders eligible for return, per product - a breakdown behind the headline Return rate tile above." />
            <div>
              {returnRateByProduct!.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">No return-eligible orders yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, returnRateByProduct!.length * 36)}>
                  <BarChart data={returnRateByProduct!} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" unit="%" tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
                    <YAxis
                      type="category"
                      dataKey="productTitle"
                      width={140}
                      tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }}
                    />
                    <Tooltip
                      formatter={(value: unknown) => [`${Number(value ?? 0)}%`, "Return rate"]}
                      contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 12 }}
                    />
                    <Bar dataKey="returnRate" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </DashCard>
          </Reveal>

          <Reveal>
          <DashCard>
            <DashCardHeader title="Deal performance" description="Orders, units, and revenue attributable to each deal - confirmed orders only (SRS §5.67/FR-67.5)." />
            <div>
              {dealPerformance!.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">No confirmed deal orders yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, dealPerformance!.length * 36)}>
                  <BarChart data={dealPerformance!} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
                    <YAxis type="category" dataKey="title" width={140} tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }} />
                    <Tooltip
                      formatter={(value: unknown) => [`Rs ${Number(value ?? 0).toLocaleString()}`, "Revenue"]}
                      contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </DashCard>
          </Reveal>
        </div>
      )}
    </div>
  );
}
