"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";
import { adminApi } from "@/lib/admin-api";

interface DstudioPackPurchase {
  id: string;
  amount: string;
  currency: string;
  status: "pending" | "verified" | "rejected";
  requestedAt: string;
  verifiedAt: string | null;
  seller: { id: string; user: { email: string } };
}

const statusTone: Record<DstudioPackPurchase["status"], "warning" | "success" | "neutral"> = {
  pending: "warning",
  verified: "success",
  rejected: "neutral",
};

/**
 * FR-8.21 (Module 100, founder batch B18) - D-Studio Pack admin
 * verification queue, same shape as /admin/invoices (wallet top-ups):
 * per-row verify/reject against the real pending/verified/rejected
 * status. Verifying grants a time-limited full-catalog unlock (seller-
 * scoped dstudio.tier_override_order + expiresAt) - not a wallet credit.
 */
export default function AdminDstudioPackPurchasesPage() {
  const [requests, setRequests] = useState<DstudioPackPurchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    adminApi
      .get<DstudioPackPurchase[]>("/admin/dstudio-pack-purchases")
      .then(setRequests)
      .catch(() => setRequests([]));
  }

  useEffect(load, []);

  async function verify(id: string) {
    setError(null);
    try {
      await adminApi.post(`/admin/dstudio-pack-purchases/${id}/verify`);
      load();
    } catch {
      setError("Couldn't verify that purchase.");
    }
  }

  async function reject(id: string) {
    setError(null);
    try {
      await adminApi.post(`/admin/dstudio-pack-purchases/${id}/reject`);
      load();
    } catch {
      setError("Couldn't reject that purchase.");
    }
  }

  if (!requests) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="D-Studio Pack purchases"
        description="FR-8.21 - sellers on any plan tier can buy a time-boxed full D-Studio catalog unlock. Verify a bank transfer to grant it for the configured duration, or reject a request that never arrived."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {requests.length === 0 ? (
        <DashCard>
          <EmptyState title="No Pack purchase requests" description="Seller-purchased D-Studio Pack requests will show up here." />
        </DashCard>
      ) : (
        <DashCard className="divide-y divide-border">
          <Reveal stagger={0.03}>
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{r.seller.user.email}</p>
                  <p className="text-xs text-ink-muted">
                    {r.currency} {r.amount} · requested {new Date(r.requestedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                  {r.status === "pending" && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => verify(r.id)}>
                        Verify
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => reject(r.id)}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </Reveal>
        </DashCard>
      )}
    </div>
  );
}
