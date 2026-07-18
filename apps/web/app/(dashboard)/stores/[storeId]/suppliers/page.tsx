"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

type LinkStatus = "pending_seller_review" | "active" | "revoked";

interface SupplierLink {
  id: string;
  supplierId: string;
  status: LinkStatus;
  invitedBy: "seller" | "supplier";
  createdAt: string;
}

const statusTone: Record<LinkStatus, "neutral" | "success" | "warning"> = {
  pending_seller_review: "warning",
  active: "success",
  revoked: "neutral",
};
const statusLabel: Record<LinkStatus, string> = {
  pending_seller_review: "needs your review",
  active: "active",
  revoked: "revoked",
};

/**
 * Optional by design (SIMPLICITY INVARIANT): a self-fulfilled seller with no
 * supplier connections never needs this screen - the sidebar only links here
 * once at least one supplier link exists (see Sidebar.tsx).
 */
export default function SupplierLinksPage({ params }: { params: { storeId: string } }) {
  const [links, setLinks] = useState<SupplierLink[] | null>(null);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<SupplierLink[]>(`/stores/${params.storeId}/supplier-links`)
      .then(setLinks)
      .catch(() => setLinks([]));
  }

  useEffect(load, [params.storeId]);

  if (!links) return <PageSpinner />;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await api.post(`/stores/${params.storeId}/supplier-links`, { supplierEmail: email });
      setEmail("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't invite that supplier.");
    } finally {
      setInviting(false);
    }
  }

  async function approve(linkId: string) {
    setError(null);
    try {
      await api.patch(`/stores/${params.storeId}/supplier-links/${linkId}/approve`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't approve that link.");
    }
  }

  async function revoke(linkId: string) {
    setError(null);
    try {
      await api.patch(`/stores/${params.storeId}/supplier-links/${linkId}/revoke`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke that link.");
    }
  }

  return (
    <div>
      <PageHeader title="Suppliers" description="Local suppliers whose products you can list and sell from your store." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Invite a supplier" description="Enter the email address they used to sign up as a supplier." />
          <CardBody>
            <form onSubmit={invite} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Supplier email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Field>
              </div>
              <Button type="submit" loading={inviting}>
                Invite
              </Button>
            </form>
          </CardBody>
        </Card>

        {links.length === 0 ? (
          <Card>
            <EmptyState
              title="No suppliers connected"
              description="Selling entirely your own products? You can ignore this screen - it's only needed if you want to list another supplier's products."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-ink">Supplier {link.supplierId.slice(0, 8)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {link.invitedBy === "seller" ? "You invited this supplier" : "This supplier requested to connect"} ·{" "}
                    {new Date(link.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={statusTone[link.status]}>{statusLabel[link.status]}</Badge>
                  {link.status === "pending_seller_review" && (
                    <Button variant="secondary" size="sm" onClick={() => approve(link.id)}>
                      Approve
                    </Button>
                  )}
                  {link.status === "active" && (
                    <Button variant="ghost" size="sm" onClick={() => revoke(link.id)}>
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
