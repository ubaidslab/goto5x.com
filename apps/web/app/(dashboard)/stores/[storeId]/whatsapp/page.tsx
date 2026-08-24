"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { toast } from "@/lib/use-toast";
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
  const [template, setTemplate] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    api
      .get<AbandonedCart[]>(`/stores/${params.storeId}/whatsapp/carts/abandoned`)
      .then(setCarts)
      .catch(() => setCarts([]));
    api
      .get<{ template: string }>(`/stores/${params.storeId}/whatsapp/settings/cart-recovery-template`)
      .then((r) => setTemplate(r.template))
      .catch(() => setTemplate(""));
  }, [params.storeId]);

  async function saveTemplate() {
    if (template === null) return;
    setError(null);
    setSavingTemplate(true);
    try {
      await api.put(`/stores/${params.storeId}/whatsapp/settings/cart-recovery-template`, { template });
      toast({ tone: "success", title: "Cart-recovery message template saved" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that template.");
    } finally {
      setSavingTemplate(false);
    }
  }

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

      {error && <Alert tone="danger">{error}</Alert>}

      <Reveal>
      <Card className="mb-6">
        <CardHeader
          title="Cart-recovery message template"
          description="What the recovery link's pre-filled message says. Placeholders {{item_summary}}, {{store_name}}, and {{store_link}} are filled in per cart."
        />
        <CardBody>
          {template === null ? (
            <PageSpinner />
          ) : (
            <>
              <Textarea rows={3} value={template} onChange={(e) => setTemplate(e.target.value)} maxLength={2000} />
              <Button className="mt-3" loading={savingTemplate} onClick={saveTemplate}>
                Save template
              </Button>
            </>
          )}
        </CardBody>
      </Card>
      </Reveal>

      {carts === null ? (
        <PageSpinner />
      ) : carts.length === 0 ? (
        <Card>
          <EmptyState title="No abandoned carts" description="Carts flagged abandoned will show up here." />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          <Reveal stagger={0.04}>
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
          </Reveal>
        </Card>
      )}
    </div>
  );
}
