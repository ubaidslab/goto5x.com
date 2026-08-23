"use client";

import { useEffect, useState } from "react";
import { Clock4, RotateCcw, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert } from "@/components/ui/Alert";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
  bestDayOfWeek: number | null;
  bestHourOfDay: number | null;
}

interface ReturnRateByProductRow {
  productId: string;
  productTitle: string;
  returnRate: number;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:00 ${period}`;
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
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 text-ink-muted">
          <Icon className="h-4 w-4" />
          <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        </div>
        <p className="mt-1 text-3xl font-semibold text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      </CardBody>
    </Card>
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<TopProductRow[]>(`/stores/${params.storeId}/analytics/top-products?by=${topProductsBy}&limit=10`)
      .then(setTopProducts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load top products."));
  }, [params.storeId, topProductsBy]);

  useEffect(() => {
    const range = rangeStart && rangeEnd ? `&start=${rangeStart}&end=${rangeEnd}` : "";
    api
      .get<SalesBucketPoint[]>(`/stores/${params.storeId}/analytics/sales-over-time?bucket=${bucket}${range}`)
      .then(setSalesOverTime)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load sales over time."));
  }, [params.storeId, bucket, rangeStart, rangeEnd]);

  useEffect(() => {
    api
      .get<Overview>(`/stores/${params.storeId}/analytics/overview`)
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the analytics overview."));
  }, [params.storeId]);

  useEffect(() => {
    api
      .get<ReturnRateByProductRow[]>(`/stores/${params.storeId}/analytics/return-rate-by-product`)
      .then(setReturnRateByProduct)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load return rate by product."));
  }, [params.storeId]);

  const loading = topProducts === null || salesOverTime === null || overview === null || returnRateByProduct === null;

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
          <Reveal stagger={0.08} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={Users} label="Repeat customers" value={`${overview!.repeatCustomerRate}%`} hint="Ordered more than once" />
            <StatTile icon={RotateCcw} label="Return rate" value={`${overview!.returnRate}%`} hint="Of confirmed orders" />
            <StatTile icon={Wallet} label="Average order value" value={`Rs ${overview!.aov.toLocaleString()}`} />
            <StatTile
              icon={Clock4}
              label="Best time to sell"
              value={overview!.bestDayOfWeek !== null ? DAY_NAMES[overview!.bestDayOfWeek] : "No data yet"}
              hint={overview!.bestHourOfDay !== null ? `Around ${formatHour(overview!.bestHourOfDay)}` : undefined}
            />
          </Reveal>

          <Reveal>
          <Card>
            <CardHeader
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
            <CardBody>
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
            </CardBody>
          </Card>
          </Reveal>

          <Reveal>
          <Card>
            <CardHeader
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
            <CardBody>
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
            </CardBody>
          </Card>
          </Reveal>

          <Reveal>
          <Card>
            <CardHeader title="Return rate by product" description="Of orders eligible for return, per product - a breakdown behind the headline Return rate tile above." />
            <CardBody>
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
            </CardBody>
          </Card>
          </Reveal>
        </div>
      )}
    </div>
  );
}
