"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminApiError, adminApi } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";

interface MrrAnalytics {
  mrr: number;
  activeSubscriptionCount: number;
  realizedRevenueThisMonth: number;
  realizedRevenueThisQuarter: number;
  arps: number;
  ltvEstimate: number | null;
  churnRatePercent: number;
  upcomingRenewals7d: number;
  upcomingRenewals30d: number;
}

interface TopUpRequest {
  id: string;
  ownerType: "seller" | "supplier";
  ownerId: string;
  amount: string;
  currency: string;
  method: string;
  requestedAt: string;
}

interface RefundHistory {
  items: { id: string; sellerBusinessName: string; orderId: string | null; amount: number; currency: string; createdAt: string }[];
  page: number;
  limit: number;
  total: number;
  totalRefunded: number;
}

interface GrowthProgramObligations {
  byProgram: { programType: string; outstandingAmount: number; count: number }[];
  totalOutstanding: number;
}

interface CommissionByTier {
  globalDefault: number;
  tiers: { planId: string; tierName: string; commissionPercent: number; isOverriddenFromGlobal: boolean }[];
}

/**
 * Phase 6c (Admin Terminal re-skin) - the Finance Terminal, restyled onto
 * DashCard. Every section/field/action preserved: revenue overview,
 * pending-verification queue (linked to the full workflow on /admin/
 * invoices), refund history + pagination, growth-program obligations,
 * platform payment instructions link, commission-by-tier, CSV/PDF export.
 */
export default function AdminFinanceTerminalPage() {
  const [mrr, setMrr] = useState<MrrAnalytics | null>(null);
  const [pending, setPending] = useState<TopUpRequest[] | null>(null);
  const [refunds, setRefunds] = useState<RefundHistory | null>(null);
  const [obligations, setObligations] = useState<GrowthProgramObligations | null>(null);
  const [commission, setCommission] = useState<CommissionByTier | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [refundPage, setRefundPage] = useState(1);

  useEffect(() => {
    adminApi.get<MrrAnalytics>("/admin/analytics/mrr").then(setMrr).catch(() => {});
    adminApi.get<TopUpRequest[]>("/admin/wallet-topups").then(setPending).catch(() => {});
    adminApi.get<GrowthProgramObligations>("/admin/finance/growth-program-obligations").then(setObligations).catch(() => {});
    adminApi.get<CommissionByTier>("/admin/finance/commission-by-tier").then(setCommission).catch(() => {});
  }, []);

  useEffect(() => {
    adminApi.get<RefundHistory>(`/admin/finance/refunds?page=${refundPage}&limit=10`).then(setRefunds).catch(() => {});
  }, [refundPage]);

  async function downloadExport(format: "csv" | "pdf") {
    setExportError(null);
    setExporting(format);
    try {
      const blob = await adminApi.download(`/admin/finance/export.${format}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-terminal-summary.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof AdminApiError ? err.message : `Couldn't generate the ${format.toUpperCase()} export.`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Finance Terminal"
        description="Every platform-wide financial surface in one place - revenue, pending payment verification, refunds, growth-program obligations, commission status, and export."
      />

      <DashCard className="mb-4">
        <DashCardHeader title="Revenue overview" />
        {!mrr ? (
          <PageSpinner />
        ) : (
          <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-4" stagger={0.05}>
            {[
              ["MRR", mrr.mrr.toFixed(2)],
              ["Active subscriptions", String(mrr.activeSubscriptionCount)],
              ["Realized revenue (month)", mrr.realizedRevenueThisMonth.toFixed(2)],
              ["Realized revenue (quarter)", mrr.realizedRevenueThisQuarter.toFixed(2)],
              ["ARPS", mrr.arps.toFixed(2)],
              ["LTV estimate", mrr.ltvEstimate === null ? "-" : mrr.ltvEstimate.toFixed(2)],
              ["Churn rate", `${mrr.churnRatePercent}%`],
              ["Renewals (7d / 30d)", `${mrr.upcomingRenewals7d} / ${mrr.upcomingRenewals30d}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-canvas p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
              </div>
            ))}
          </Reveal>
        )}
      </DashCard>

      <DashCard className="mb-4">
        <DashCardHeader
          title="Pending payment verification"
          action={
            <Link href="/admin/invoices" className="text-sm font-medium text-accent hover:opacity-80">
              Full verification queue &rarr;
            </Link>
          }
        />
        {!pending ? (
          <PageSpinner />
        ) : pending.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing pending.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-ink-muted">{pending.length} request(s) waiting on verification.</p>
            <div className="divide-y divide-border">
              {pending.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="text-ink">
                    {r.ownerType} · {r.method}
                  </span>
                  <span className="tabular-nums text-ink-muted">
                    {r.amount} {r.currency} · {new Date(r.requestedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </DashCard>

      <DashCard className="mb-4">
        <DashCardHeader title="Refund history & totals" />
        {!refunds ? (
          <PageSpinner />
        ) : (
          <>
            <p className="mb-2 text-sm text-ink-muted">
              Total refunded (platform-wide): <span className="font-medium text-ink">{refunds.totalRefunded.toFixed(2)}</span> - {refunds.total} refund(s)
            </p>
            <div className="divide-y divide-border">
              {refunds.items.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="text-ink">
                    {r.sellerBusinessName} <span className="text-ink-muted">· {r.orderId ?? "-"}</span>
                  </span>
                  <span className="tabular-nums text-ink-muted">
                    {r.amount.toFixed(2)} {r.currency} · {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <Button variant="ghost" size="sm" disabled={refundPage <= 1} onClick={() => setRefundPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-ink-muted">Page {refunds.page}</span>
              <Button variant="ghost" size="sm" disabled={refundPage * refunds.limit >= refunds.total} onClick={() => setRefundPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </>
        )}
      </DashCard>

      <DashCard className="mb-4">
        <DashCardHeader
          title="Growth-program obligations (outstanding)"
          action={
            <Link href="/admin/growth-programs/withdrawals" className="text-sm font-medium text-accent hover:opacity-80">
              Withdrawal approval queue &rarr;
            </Link>
          }
        />
        {!obligations ? (
          <PageSpinner />
        ) : (
          <div className="divide-y divide-border">
            {obligations.byProgram.map((p) => (
              <div key={p.programType} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-ink">
                  {p.programType} <span className="text-ink-muted">({p.count})</span>
                </span>
                <span className="tabular-nums text-ink-muted">{p.outstandingAmount.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 py-2 text-sm font-semibold">
              <span className="text-ink">Total</span>
              <span className="tabular-nums text-ink">{obligations.totalOutstanding.toFixed(2)}</span>
            </div>
          </div>
        )}
      </DashCard>

      <DashCard className="mb-4">
        <DashCardHeader title="Platform payment instructions" />
        <Link href="/admin/payment-instructions" className="text-sm font-medium text-accent hover:opacity-80">
          Edit platform payment instructions &rarr;
        </Link>
      </DashCard>

      <DashCard className="mb-4">
        <DashCardHeader title="Commission status by tier" description={commission ? `Global default: ${commission.globalDefault}%` : undefined} />
        {!commission ? (
          <PageSpinner />
        ) : (
          <div className="divide-y divide-border">
            {commission.tiers.map((t) => (
              <div key={t.planId} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-ink">{t.tierName}</span>
                <span className="tabular-nums text-ink-muted">
                  {t.commissionPercent}% {t.isOverriddenFromGlobal && <span className="text-ink-faint">(overridden)</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </DashCard>

      <DashCard>
        <DashCardHeader title="Export" />
        {exportError && <Alert tone="danger">{exportError}</Alert>}
        <div className="flex gap-2">
          <Button variant="secondary" loading={exporting === "csv"} onClick={() => downloadExport("csv")}>
            Download CSV
          </Button>
          <Button variant="secondary" loading={exporting === "pdf"} onClick={() => downloadExport("pdf")}>
            Download PDF
          </Button>
        </div>
      </DashCard>
    </div>
  );
}
