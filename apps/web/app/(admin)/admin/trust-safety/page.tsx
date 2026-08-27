"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";

interface RateFlag {
  sellerId: string;
  totalOrders: number;
  matchingOrders: number;
  ratePercent: number;
}
interface SignupVelocityFlag {
  ipAddress: string;
  signupCount: number;
}
interface BypassAttemptFlag {
  sellerId: string;
  attemptCount: number;
}
interface SelfReferralFlag {
  referrerSellerId: string;
  referredSellerId: string;
  matchedSignal: "cnic" | "payment_instrument" | "device_or_ip";
}
interface PaymentReviewItem {
  storeId: string;
  bankAccountTitle: string | null;
  jazzcashAccountTitle: string | null;
  easypaisaAccountTitle: string | null;
  nameConsistencyStatus: string;
  store: { name: string } | null;
}

function FlagTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <EmptyState title="Nothing flagged" description="No entries currently match this monitor." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {headers.map((h) => (
              <th key={h} className="py-2 pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Phase 6d (Admin Terminal re-skin) - SRS §5.29/§5.30's T&S risk monitors
 * (FR-29.3/FR-6.19), payment-instrument review queue (FR-30.2), and Seller
 * Agreement version publishing (FR-29.1), restyled onto DashCard. Every
 * monitor/table/action preserved. Switched from hand-rolled fetch to
 * adminApi.
 */
export default function AdminTrustSafetyPage() {
  const [cancellationRate, setCancellationRate] = useState<RateFlag[]>([]);
  const [pendingForeverRate, setPendingForeverRate] = useState<RateFlag[]>([]);
  const [signupVelocity, setSignupVelocity] = useState<SignupVelocityFlag[]>([]);
  const [bypassAttempts, setBypassAttempts] = useState<BypassAttemptFlag[]>([]);
  const [selfReferral, setSelfReferral] = useState<SelfReferralFlag[]>([]);
  const [reviewQueue, setReviewQueue] = useState<PaymentReviewItem[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [newVersion, setNewVersion] = useState("");

  function load() {
    adminApi.get<RateFlag[]>("/admin/trust-safety/monitors/cancellation-rate").then(setCancellationRate).catch(() => {});
    adminApi.get<RateFlag[]>("/admin/trust-safety/monitors/pending-forever-rate").then(setPendingForeverRate).catch(() => {});
    adminApi.get<SignupVelocityFlag[]>("/admin/trust-safety/monitors/signup-velocity").then(setSignupVelocity).catch(() => {});
    adminApi.get<BypassAttemptFlag[]>("/admin/trust-safety/monitors/bypass-attempts").then(setBypassAttempts).catch(() => {});
    adminApi.get<SelfReferralFlag[]>("/admin/trust-safety/monitors/self-referral").then(setSelfReferral).catch(() => {});
    adminApi.get<PaymentReviewItem[]>("/admin/trust-safety/payment-review/queue").then(setReviewQueue).catch(() => {});
    adminApi
      .get<{ version: string }>("/admin/trust-safety/agreement-versions/current")
      .then((v) => setCurrentVersion(v.version))
      .catch(() => {});
  }

  useEffect(load, []);

  async function decideReview(storeId: string, decision: "approve" | "reject") {
    await adminApi.post(`/admin/trust-safety/payment-review/${storeId}/${decision}`, {});
    load();
  }

  async function publishVersion(e: React.FormEvent) {
    e.preventDefault();
    await adminApi.post("/admin/trust-safety/agreement-versions", { version: newVersion });
    setNewVersion("");
    load();
  }

  return (
    <div>
      <PageHeader title="Trust & Safety" description="Review flagged sellers, decide on held payment instruments, and publish new Seller Agreement versions." />

      <DashCard className="mb-4">
        <DashCardHeader title="Payment-instrument review queue" description="FR-30.2" />
        {reviewQueue.length === 0 ? (
          <EmptyState title="Nothing pending review" description="Held payment instruments needing manual review will show up here." />
        ) : (
          <div className="divide-y divide-border">
            {reviewQueue.map((item) => (
              <div key={item.storeId} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink">{item.store?.name ?? item.storeId}</p>
                  <p className="text-xs text-ink-muted">
                    Bank: {item.bankAccountTitle} · JazzCash: {item.jazzcashAccountTitle} · Easypaisa: {item.easypaisaAccountTitle} · {item.nameConsistencyStatus}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => decideReview(item.storeId, "approve")}>
                    Approve
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => decideReview(item.storeId, "reject")}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashCard>
          <DashCardHeader title="Cancellation-rate flags" description="FR-6.19" />
          <FlagTable
            headers={["Seller", "Total orders", "Cancelled", "Rate"]}
            rows={cancellationRate.map((f) => [f.sellerId, f.totalOrders, f.matchingOrders, `${f.ratePercent.toFixed(1)}%`])}
          />
        </DashCard>

        <DashCard>
          <DashCardHeader title="Pending-forever-rate flags" description="FR-6.19" />
          <FlagTable
            headers={["Seller", "Total orders", "Stuck pending", "Rate"]}
            rows={pendingForeverRate.map((f) => [f.sellerId, f.totalOrders, f.matchingOrders, `${f.ratePercent.toFixed(1)}%`])}
          />
        </DashCard>

        <DashCard>
          <DashCardHeader title="Signup-velocity flags" description="FR-29.3" />
          <FlagTable headers={["IP address", "Signup count"]} rows={signupVelocity.map((f) => [f.ipAddress, f.signupCount])} />
        </DashCard>

        <DashCard>
          <DashCardHeader title="Bypass-attempt flags" description="FR-29.3" />
          <FlagTable headers={["Seller", "Attempt count"]} rows={bypassAttempts.map((f) => [f.sellerId, f.attemptCount])} />
        </DashCard>
      </div>

      <DashCard className="my-4">
        <DashCardHeader title="Self-referral / fake-cluster flags" description="FR-33.10" />
        <FlagTable
          headers={["Referrer seller", "Referred seller", "Matched signal"]}
          rows={selfReferral.map((f) => [f.referrerSellerId, f.referredSellerId, f.matchedSignal])}
        />
      </DashCard>

      <DashCard className="max-w-xl">
        <DashCardHeader title="Seller Agreement version" description={`FR-29.1 · Current version: ${currentVersion}`} />
        <form onSubmit={publishVersion} className="flex items-end gap-2">
          <div className="flex-1">
            <Input placeholder="New version, e.g. 1.1" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} required />
          </div>
          <Button type="submit">Publish new version</Button>
        </form>
      </DashCard>
    </div>
  );
}
