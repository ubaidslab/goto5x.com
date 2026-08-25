"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Reveal } from "@/components/motion/Reveal";
import { ApiError, api } from "@/lib/dashboard-api";

type OrderBucket = "pending" | "awaitingVerification" | "prepaidReceived" | "awaitingTracking" | "shipped" | "delivered" | "cancelledReturned";

interface OrdersOverview {
  buckets: Record<OrderBucket, number>;
  total: number;
  supplierItemsAwaitingFulfillment: number;
}
interface AwaitingTrackingOrder {
  id: string;
  orderNumber: number;
  buyerEmail: string;
  currency: string;
  totalAmount: string;
  placedAt: string;
  missingTrackingAlertedAt: string | null;
  items: { id: string }[];
}
interface ShippingSettings {
  flatRate: string;
  freeShippingThreshold: string | null;
}
interface TaxSettings {
  taxRate: string;
  taxInclusive: boolean;
  taxLabel: string;
}

const BUCKET_LABELS: { bucket: OrderBucket; label: string }[] = [
  { bucket: "pending", label: "Pending" },
  { bucket: "awaitingVerification", label: "Awaiting verification" },
  { bucket: "prepaidReceived", label: "Prepaid received" },
  { bucket: "awaitingTracking", label: "Awaiting tracking" },
  { bucket: "shipped", label: "Shipped" },
  { bucket: "delivered", label: "Delivered" },
  { bucket: "cancelledReturned", label: "Cancelled / returned" },
];

/**
 * Phase 5b (founder spec) - two-part hub: PRIMARY tracking view built from
 * the same Orders Command Center data (Module 27's orderBucketWhereClause/
 * overview endpoint), with orders the missing-tracking sweep (Phase 5a) has
 * already flagged surfaced first; SECONDARY the pre-existing shipping/tax
 * settings, now a tab rather than the whole page. Bucket tiles are read-only
 * summaries here - full filtering/bulk actions/CSV import stay on the
 * Orders page (linked out) rather than being duplicated.
 */
export default function ShippingTrackingPage({ params }: { params: { storeId: string } }) {
  const [overview, setOverview] = useState<OrdersOverview | null>(null);
  const [awaitingTracking, setAwaitingTracking] = useState<AwaitingTrackingOrder[] | null>(null);

  const [shipping, setShipping] = useState<ShippingSettings | null>(null);
  const [tax, setTax] = useState<TaxSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingShipping, setSavingShipping] = useState(false);
  const [savingTax, setSavingTax] = useState(false);

  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, { trackingId: string; carrier: string }>>({});
  const [savingTrackingFor, setSavingTrackingFor] = useState<string | null>(null);
  const [trackingErrors, setTrackingErrors] = useState<Record<string, string>>({});

  function reloadTracking() {
    api
      .get<OrdersOverview>(`/stores/${params.storeId}/orders/overview`)
      .then(setOverview)
      .catch(() => setOverview(null));
    api
      .get<{ items: AwaitingTrackingOrder[] }>(`/stores/${params.storeId}/orders?bucket=awaitingTracking&limit=100`)
      .then((page) =>
        setAwaitingTracking(
          [...page.items].sort((a, b) => {
            if (!!a.missingTrackingAlertedAt !== !!b.missingTrackingAlertedAt) return a.missingTrackingAlertedAt ? -1 : 1;
            return new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime();
          }),
        ),
      )
      .catch(() => setAwaitingTracking([]));
  }

  useEffect(reloadTracking, [params.storeId]);

  useEffect(() => {
    api.get<ShippingSettings>(`/stores/${params.storeId}/shipping-settings`).then(setShipping).catch(() => setShipping(null));
    api.get<TaxSettings>(`/stores/${params.storeId}/tax-settings`).then(setTax).catch(() => setTax(null));
  }, [params.storeId]);

  function trackingDraft(orderId: string) {
    return trackingDrafts[orderId] ?? { trackingId: "", carrier: "" };
  }

  function setTrackingDraft(orderId: string, field: "trackingId" | "carrier", value: string) {
    setTrackingDrafts((prev) => ({ ...prev, [orderId]: { ...trackingDraft(orderId), [field]: value } }));
  }

  async function saveTracking(orderId: string) {
    const draft = trackingDraft(orderId);
    if (!draft.trackingId.trim()) return;
    setSavingTrackingFor(orderId);
    setTrackingErrors((prev) => ({ ...prev, [orderId]: "" }));
    try {
      await api.post(`/stores/${params.storeId}/orders/${orderId}/tracking`, {
        trackingId: draft.trackingId.trim(),
        carrier: draft.carrier.trim() || undefined,
      });
      setTrackingDrafts((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      reloadTracking();
    } catch (err) {
      setTrackingErrors((prev) => ({ ...prev, [orderId]: err instanceof ApiError ? err.message : "Couldn't save tracking." }));
    } finally {
      setSavingTrackingFor(null);
    }
  }

  async function saveShipping(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavingShipping(true);
    const form = new FormData(e.currentTarget);
    const freeShippingThreshold = form.get("freeShippingThreshold") as string;
    try {
      const updated = await api.patch<ShippingSettings>(`/stores/${params.storeId}/shipping-settings`, {
        flatRate: Number(form.get("flatRate")),
        freeShippingThreshold: freeShippingThreshold ? Number(freeShippingThreshold) : null,
      });
      setShipping(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save shipping settings.");
    } finally {
      setSavingShipping(false);
    }
  }

  async function saveTax(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavingTax(true);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.patch<TaxSettings>(`/stores/${params.storeId}/tax-settings`, {
        taxRate: Number(form.get("taxRate")),
        taxLabel: form.get("taxLabel") as string,
        taxInclusive: form.get("taxInclusive") === "on",
      });
      setTax(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save tax settings.");
    } finally {
      setSavingTax(false);
    }
  }

  if (!shipping || !tax || !overview || !awaitingTracking) return <PageSpinner />;

  const flaggedCount = awaitingTracking.filter((o) => o.missingTrackingAlertedAt).length;

  return (
    <div>
      <PageHeader title="Shipping & tracking" description="What needs tracking uploaded, at a glance, plus your shipping and tax rules." />

      {error && <Alert tone="danger">{error}</Alert>}

      <Tabs defaultValue="tracking">
        <TabsList>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="settings">Shipping & tax</TabsTrigger>
        </TabsList>

        <TabsContent value="tracking">
          <Reveal className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" stagger={0.06}>
            {BUCKET_LABELS.map(({ bucket, label }) => (
              <div key={bucket} className="rounded-md border border-border bg-surface p-3">
                <p className="text-2xl font-semibold tabular-nums text-ink">{overview.buckets[bucket]}</p>
                <p className="text-xs text-ink-muted">{label}</p>
              </div>
            ))}
          </Reveal>

          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Awaiting tracking</h2>
              <p className="text-xs text-ink-muted">
                Confirmed orders with no tracking uploaded on any item yet. Orders that stay here too long are flagged automatically and the
                responsible party (you, or the fulfilling supplier) is emailed.
              </p>
            </div>
            <Link href={`/stores/${params.storeId}/orders`}>
              <Button variant="ghost">View all orders</Button>
            </Link>
          </div>

          {flaggedCount > 0 && (
            <Alert tone="warning" className="mb-4">
              {flaggedCount} order{flaggedCount === 1 ? "" : "s"} flagged for missing tracking - overdue past the alert threshold.
            </Alert>
          )}

          {awaitingTracking.length === 0 ? (
            <Card>
              <EmptyState title="Nothing awaiting tracking" description="Every confirmed order currently has tracking uploaded." />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <Reveal className="divide-y divide-border" stagger={0.03}>
                {awaitingTracking.map((order) => {
                  const draft = trackingDraft(order.id);
                  const flagged = !!order.missingTrackingAlertedAt;
                  return (
                    <div key={order.id} className="flex flex-col gap-2 px-6 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <Link href={`/stores/${params.storeId}/orders/${order.id}`} className="min-w-0 transition-smooth-fast hover:opacity-80">
                          <p className="truncate text-sm font-medium text-ink">
                            #{order.orderNumber} · {order.buyerEmail}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {new Date(order.placedAt).toLocaleDateString()} · {order.currency} {order.totalAmount}
                          </p>
                        </Link>
                        {flagged && (
                          <Badge tone="warning" dot>
                            Flagged - missing tracking
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          placeholder="Tracking ID"
                          className="h-8 w-40"
                          value={draft.trackingId}
                          onChange={(e) => setTrackingDraft(order.id, "trackingId", e.target.value)}
                        />
                        <Input
                          placeholder="Courier (optional)"
                          className="h-8 w-40"
                          value={draft.carrier}
                          onChange={(e) => setTrackingDraft(order.id, "carrier", e.target.value)}
                        />
                        <Button
                          variant="ghost"
                          className="h-8"
                          disabled={!draft.trackingId.trim()}
                          loading={savingTrackingFor === order.id}
                          onClick={() => saveTracking(order.id)}
                        >
                          Save tracking
                        </Button>
                        {trackingErrors[order.id] && <span className="text-xs text-danger">{trackingErrors[order.id]}</span>}
                      </div>
                    </div>
                  );
                })}
              </Reveal>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader title="Shipping" description="One flat rate for every order, with an optional free-shipping threshold." />
              <CardBody>
                <form onSubmit={saveShipping} className="space-y-4">
                  <Field label="Flat shipping rate" hint="Charged on every order, in your store's currency.">
                    <Input name="flatRate" type="number" step="0.01" min="0" defaultValue={shipping.flatRate} required />
                  </Field>
                  <Field label="Free shipping threshold" hint="Orders at or above this subtotal ship free. Leave blank to disable.">
                    <Input name="freeShippingThreshold" type="number" step="0.01" min="0" defaultValue={shipping.freeShippingThreshold ?? ""} />
                  </Field>
                  <Button type="submit" loading={savingShipping}>
                    Save shipping
                  </Button>
                </form>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Tax" description="One tax rate applied storewide." />
              <CardBody>
                <form onSubmit={saveTax} className="space-y-4">
                  <Field label="Tax rate (%)">
                    <Input name="taxRate" type="number" step="0.01" min="0" max="100" defaultValue={tax.taxRate} required />
                  </Field>
                  <Field label="Tax label" hint="Shown to buyers on their order summary, e.g. GST or Sales Tax.">
                    <Input name="taxLabel" maxLength={40} defaultValue={tax.taxLabel} required />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" name="taxInclusive" defaultChecked={tax.taxInclusive} />
                    Prices already include tax
                  </label>
                  <Button type="submit" loading={savingTax}>
                    Save tax
                  </Button>
                </form>
              </CardBody>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
