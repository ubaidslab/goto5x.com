"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface PeriodProfit {
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  revenue: number;
  commission: number;
  cogs: number;
  courierCost: number;
  handlingCost: number;
  adSpend: number;
  netProfit: number;
  incomplete: boolean;
}

interface AdSpendEntry {
  id: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  source: "manual" | "csv_import";
  note: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * SRS §5.42/FR-42.1-42.5 (Module 31) - the headline differentiator: revenue
 * vs true net profit side by side, computed only from CONFIRMED+ orders
 * (Financial Truth Invariant). Bare functional UI - premium redesign comes
 * in the later design phase.
 */
export default function ProfitAndLossPage({ params }: { params: { storeId: string } }) {
  const [periodStart, setPeriodStart] = useState(firstOfMonthIso());
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [period, setPeriod] = useState<PeriodProfit | null>(null);
  const [adSpend, setAdSpend] = useState<AdSpendEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [entryStart, setEntryStart] = useState(firstOfMonthIso());
  const [entryEnd, setEntryEnd] = useState(todayIso());
  const [entryAmount, setEntryAmount] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadPeriod() {
    setError(null);
    setLoading(true);
    api
      .get<PeriodProfit>(`/stores/${params.storeId}/pnl/period?periodStart=${periodStart}&periodEnd=${periodEnd}`)
      .then(setPeriod)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load profit for this period."))
      .finally(() => setLoading(false));
  }

  function loadAdSpend() {
    api
      .get<AdSpendEntry[]>(`/stores/${params.storeId}/pnl/ad-spend`)
      .then(setAdSpend)
      .catch(() => setAdSpend([]));
  }

  useEffect(loadPeriod, [params.storeId]);
  useEffect(loadAdSpend, [params.storeId]);

  async function addAdSpend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = Number(entryAmount);
    if (!Number.isFinite(amount) || amount < 0 || !entryStart || !entryEnd) {
      setError("Enter a valid amount and period.");
      return;
    }
    setSavingEntry(true);
    try {
      await api.post(`/stores/${params.storeId}/pnl/ad-spend`, {
        periodStart: entryStart,
        periodEnd: entryEnd,
        amount,
        note: entryNote.trim() || undefined,
      });
      setEntryAmount("");
      setEntryNote("");
      loadAdSpend();
      loadPeriod();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that ad-spend entry.");
    } finally {
      setSavingEntry(false);
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.upload(`/stores/${params.storeId}/ad-spend-import-jobs`, formData);
      // Import processing happens in the background (Module 15's queue) -
      // give it a moment before refreshing the list.
      setTimeout(() => {
        loadAdSpend();
        loadPeriod();
      }, 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that CSV.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        description="True net profit, not just revenue - only confirmed sales count, minus cost of goods, courier/handling, and ad spend."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title="Period" />
          <CardBody className="flex flex-wrap items-end gap-3">
            <Field label="From">
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </Field>
            <Button loading={loading} onClick={loadPeriod}>
              View
            </Button>
          </CardBody>
        </Card>

        {loading && !period ? (
          <PageSpinner />
        ) : period ? (
          <>
            {period.incomplete && (
              <Alert tone="warning">
                One or more orders in this period include a variant with no base cost entered - net profit is understated until you add
                it on that product's variant.
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardBody>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Revenue</p>
                  <p className="mt-1 text-3xl font-semibold text-ink">Rs {period.revenue.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-ink-muted">{period.orderCount} confirmed order{period.orderCount === 1 ? "" : "s"}</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Net profit</p>
                  <p className={`mt-1 text-3xl font-semibold ${period.netProfit < 0 ? "text-danger" : "text-ink"}`}>
                    Rs {period.netProfit.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">What Shopify doesn't show you</p>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader title="Breakdown" />
              <CardBody className="space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>Revenue</span>
                  <span className="text-ink">Rs {period.revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Cost of goods</span>
                  <span className="text-ink">- Rs {period.cogs.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Courier cost</span>
                  <span className="text-ink">- Rs {period.courierCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Handling cost</span>
                  <span className="text-ink">- Rs {period.handlingCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Ad spend</span>
                  <span className="text-ink">- Rs {period.adSpend.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-medium text-ink">
                  <span>Net profit</span>
                  <span>Rs {period.netProfit.toLocaleString()}</span>
                </div>
              </CardBody>
            </Card>
          </>
        ) : null}

        <Card>
          <CardHeader title="Ad spend" description="Manual entry now - a future Facebook/TikTok ad-spend API is a documented roadmap item, not built yet." />
          <CardBody>
            <form onSubmit={addAdSpend} className="flex flex-wrap items-end gap-3">
              <Field label="From">
                <Input type="date" value={entryStart} onChange={(e) => setEntryStart(e.target.value)} />
              </Field>
              <Field label="To">
                <Input type="date" value={entryEnd} onChange={(e) => setEntryEnd(e.target.value)} />
              </Field>
              <Field label="Amount (Rs)">
                <Input type="number" min={0} value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} />
              </Field>
              <Field label="Note (optional)">
                <Input value={entryNote} onChange={(e) => setEntryNote(e.target.value)} placeholder="e.g. Facebook boost" />
              </Field>
              <Button type="submit" variant="secondary" loading={savingEntry}>
                Add entry
              </Button>
            </form>

            <div className="mt-3">
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" id="ad-spend-csv-input" />
              <Button variant="ghost" loading={uploading} onClick={() => fileInputRef.current?.click()}>
                Or upload a CSV (PeriodStart, PeriodEnd, Amount, Note)
              </Button>
            </div>

            {adSpend.length > 0 && (
              <div className="mt-5 divide-y divide-border border-t border-border">
                {adSpend.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <p className="text-ink">
                        {entry.periodStart.slice(0, 10)} &rarr; {entry.periodEnd.slice(0, 10)}
                      </p>
                      {entry.note && <p className="mt-0.5 text-xs text-ink-muted">{entry.note}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-ink">Rs {Number(entry.amount).toLocaleString()}</span>
                      <Badge tone={entry.source === "manual" ? "neutral" : "info"}>{entry.source === "manual" ? "Manual" : "CSV"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
