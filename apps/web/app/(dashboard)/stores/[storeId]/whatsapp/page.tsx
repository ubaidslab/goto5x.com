"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface AbandonedCart {
  id: string;
  buyerEmail: string;
  hasWhatsapp: boolean;
  itemCount: number;
  itemSummary: string;
  subtotal: number;
  updatedAt: string;
}

/**
 * SRS §5.41/FR-41.1c - order-confirmation and shipping-update WhatsApp
 * messages live on the order-detail page (right next to the actions that
 * unlock them); abandoned-cart recovery gets its own screen since it has no
 * single order to attach to.
 */
export default function WhatsAppRecoveryPage({ params }: { params: { storeId: string } }) {
  const [carts, setCarts] = useState<AbandonedCart[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AbandonedCart[]>(`/stores/${params.storeId}/whatsapp/carts/abandoned`)
      .then(setCarts)
      .catch(() => setCarts([]));
  }, [params.storeId]);

  async function sendRecovery(cartId: string) {
    setError(null);
    setSendingId(cartId);
    try {
      const { deepLink } = await api.get<{ deepLink: string }>(`/stores/${params.storeId}/whatsapp/carts/${cartId}/recovery-link`);
      window.open(deepLink, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate that recovery message.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="WhatsApp recovery"
        description="Abandoned carts you can nudge with a one-click WhatsApp message. Order confirmations and shipping updates live on each order's own page."
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {carts === null ? (
        <PageSpinner />
      ) : carts.length === 0 ? (
        <Card>
          <EmptyState title="No abandoned carts" description="Carts flagged abandoned will show up here." />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {carts.map((cart) => (
            <div key={cart.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{cart.buyerEmail}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {cart.itemSummary} · {new Date(cart.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!cart.hasWhatsapp && <Badge tone="neutral">No WhatsApp number</Badge>}
                <Button
                  variant="secondary"
                  disabled={!cart.hasWhatsapp}
                  loading={sendingId === cart.id}
                  onClick={() => sendRecovery(cart.id)}
                >
                  Send recovery message
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
