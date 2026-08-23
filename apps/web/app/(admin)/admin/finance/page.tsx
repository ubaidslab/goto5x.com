"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminApiError, adminApi } from "@/lib/admin-api";

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
 * Founder-approved Finance Terminal (own admin nav item). Deliberately
 * re-embeds rather than duplicates: revenue overview reuses the existing
 * admin/analytics/mrr endpoint (extended with realized-revenue-by-period),
 * the pending-verification queue reuses admin/wallet-topups (full
 * verify/reject workflow stays on /admin/invoices), and Platform Payment
 * Instructions stays its own page, linked here. Only the genuinely new
 * reads (refund history/totals, growth-program obligations, commission-
 * by-tier, export) have their own new backend routes. Bare view (no design
 * pass yet), same precedent as every other admin screen.
 */
export default function AdminFinanceTerminalPage() {
  const [mrr, setMrr] = useState<MrrAnalytics | null>(null);
  const [pending, setPending] = useState<TopUpRequest[] | null>(null);
  const [refunds, setRefunds] = useState<RefundHistory | null>(null);
  const [obligations, setObligations] = useState<GrowthProgramObligations | null>(null);
  const [commission, setCommission] = useState<CommissionByTier | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
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
    }
  }

  return (
    <main>
      <h1>Finance Terminal (bare view - no design pass yet)</h1>
      <p>Every platform-wide financial surface in one place - revenue, pending payment verification, refunds, growth-program obligations, commission status, and export.</p>

      <h2>Revenue overview</h2>
      {!mrr ? (
        <p>Loading...</p>
      ) : (
        <table border={1} cellPadding={4}>
          <tbody>
            <tr><td>MRR</td><td>{mrr.mrr.toFixed(2)}</td></tr>
            <tr><td>Active subscriptions</td><td>{mrr.activeSubscriptionCount}</td></tr>
            <tr><td>Realized revenue this month</td><td>{mrr.realizedRevenueThisMonth.toFixed(2)}</td></tr>
            <tr><td>Realized revenue this quarter</td><td>{mrr.realizedRevenueThisQuarter.toFixed(2)}</td></tr>
            <tr><td>ARPS</td><td>{mrr.arps.toFixed(2)}</td></tr>
            <tr><td>LTV estimate</td><td>{mrr.ltvEstimate === null ? "-" : mrr.ltvEstimate.toFixed(2)}</td></tr>
            <tr><td>Churn rate</td><td>{mrr.churnRatePercent}%</td></tr>
            <tr><td>Upcoming renewals (7d / 30d)</td><td>{mrr.upcomingRenewals7d} / {mrr.upcomingRenewals30d}</td></tr>
          </tbody>
        </table>
      )}

      <h2>Pending payment verification</h2>
      {!pending ? (
        <p>Loading...</p>
      ) : pending.length === 0 ? (
        <p>Nothing pending.</p>
      ) : (
        <>
          <p>{pending.length} request(s) waiting on verification.</p>
          <table border={1} cellPadding={4}>
            <thead>
              <tr><th>Owner type</th><th>Amount</th><th>Method</th><th>Requested</th></tr>
            </thead>
            <tbody>
              {pending.slice(0, 5).map((r) => (
                <tr key={r.id}>
                  <td>{r.ownerType}</td>
                  <td>{r.amount} {r.currency}</td>
                  <td>{r.method}</td>
                  <td>{new Date(r.requestedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p><Link href="/admin/invoices">Go to the full verification queue &rarr;</Link></p>

      <h2>Refund history & totals</h2>
      {!refunds ? (
        <p>Loading...</p>
      ) : (
        <>
          <p>Total refunded (platform-wide): {refunds.totalRefunded.toFixed(2)} - {refunds.total} refund(s)</p>
          <table border={1} cellPadding={4}>
            <thead>
              <tr><th>Seller</th><th>Order</th><th>Amount</th><th>Date</th></tr>
            </thead>
            <tbody>
              {refunds.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.sellerBusinessName}</td>
                  <td>{r.orderId ?? "-"}</td>
                  <td>{r.amount.toFixed(2)} {r.currency}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setRefundPage((p) => Math.max(1, p - 1))} disabled={refundPage <= 1}>Previous</button>
          <span> Page {refunds.page} </span>
          <button onClick={() => setRefundPage((p) => p + 1)} disabled={refundPage * refunds.limit >= refunds.total}>Next</button>
        </>
      )}

      <h2>Growth-program obligations (outstanding)</h2>
      {!obligations ? (
        <p>Loading...</p>
      ) : (
        <table border={1} cellPadding={4}>
          <thead>
            <tr><th>Program</th><th>Count</th><th>Outstanding amount</th></tr>
          </thead>
          <tbody>
            {obligations.byProgram.map((p) => (
              <tr key={p.programType}>
                <td>{p.programType}</td>
                <td>{p.count}</td>
                <td>{p.outstandingAmount.toFixed(2)}</td>
              </tr>
            ))}
            <tr><td><strong>Total</strong></td><td></td><td><strong>{obligations.totalOutstanding.toFixed(2)}</strong></td></tr>
          </tbody>
        </table>
      )}
      <p><Link href="/admin/growth-programs/withdrawals">Go to the withdrawal approval queue &rarr;</Link></p>

      <h2>Platform payment instructions</h2>
      <p><Link href="/admin/payment-instructions">Edit platform payment instructions &rarr;</Link></p>

      <h2>Commission status by tier</h2>
      {!commission ? (
        <p>Loading...</p>
      ) : (
        <table border={1} cellPadding={4}>
          <thead>
            <tr><th>Tier</th><th>Commission %</th><th>Overridden from global?</th></tr>
          </thead>
          <tbody>
            {commission.tiers.map((t) => (
              <tr key={t.planId}>
                <td>{t.tierName}</td>
                <td>{t.commissionPercent}%</td>
                <td>{t.isOverriddenFromGlobal ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {commission && <p>Global default: {commission.globalDefault}%</p>}

      <h2>Export</h2>
      <button onClick={() => downloadExport("csv")}>Download CSV</button>{" "}
      <button onClick={() => downloadExport("pdf")}>Download PDF</button>
      {exportError && <p style={{ color: "red" }}>{exportError}</p>}
    </main>
  );
}
