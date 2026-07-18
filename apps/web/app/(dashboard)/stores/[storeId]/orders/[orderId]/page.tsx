"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | "disputed";
type FulfillmentStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed";

interface TrackingUpdate {
  id: string;
  trackingId: string;
  carrier: string | null;
  uploadedAt: string;
}
interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  supplierId: string | null;
  quantity: number;
  unitPrice: string;
  fulfillmentStatus: FulfillmentStatus;
  trackingUpdates: TrackingUpdate[];
}
interface OrderNote {
  id: string;
  body: string;
  createdAt: string;
}
interface OrderTimelineEvent {
  id: string;
  eventType: string;
  createdAt: string;
}
interface ShippingAddress {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  country: string;
  postalCode?: string;
  phone: string;
}
interface Order {
  id: string;
  buyerEmail: string;
  status: OrderStatus;
  source: "storefront" | "manual";
  shippingAddress: ShippingAddress;
  shippingAmount: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  currency: string;
  tags: string[];
  placedAt: string;
  items: OrderItem[];
  notes: OrderNote[];
  timelineEvents: OrderTimelineEvent[];
}
interface ProductLookup {
  id: string;
  title: string;
  variants: { id: string; sku: string }[];
}

const statusTone: Record<OrderStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending: "warning",
  confirmed: "info",
  shipped: "info",
  delivered: "success",
  completed: "success",
  cancelled: "neutral",
  disputed: "danger",
};

export default function OrderDetailPage({ params }: { params: { storeId: string; orderId: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<ProductLookup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [trackingByItem, setTrackingByItem] = useState<Record<string, { trackingId: string; carrier: string }>>({});

  function load() {
    api
      .get<Order>(`/stores/${params.storeId}/orders/${params.orderId}`)
      .then((o) => {
        setOrder(o);
        setTagsInput(o.tags.join(", "));
      })
      .catch(() => setOrder(null));
  }

  useEffect(load, [params.storeId, params.orderId]);
  useEffect(() => {
    api
      .get<ProductLookup[]>(`/stores/${params.storeId}/products`)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [params.storeId]);

  if (!order) return <PageSpinner />;

  function itemLabel(item: OrderItem): string {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return `Product ${item.productId.slice(0, 8)}`;
    const variant = product.variants.find((v) => v.id === item.variantId);
    return variant ? `${product.title} (${variant.sku})` : product.title;
  }

  async function markAsPaid() {
    setError(null);
    setMarkingPaid(true);
    try {
      await api.post(`/stores/${params.storeId}/orders/${params.orderId}/mark-as-paid`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't mark this order as paid.");
    } finally {
      setMarkingPaid(false);
    }
  }

  async function saveTags() {
    setError(null);
    setSavingTags(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const updated = await api.patch<Order>(`/stores/${params.storeId}/orders/${params.orderId}/tags`, { tags });
      setOrder(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save tags.");
    } finally {
      setSavingTags(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setError(null);
    setAddingNote(true);
    try {
      await api.post(`/stores/${params.storeId}/orders/${params.orderId}/notes`, { body: noteBody });
      setNoteBody("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that note.");
    } finally {
      setAddingNote(false);
    }
  }

  async function uploadTracking(itemId: string) {
    const values = trackingByItem[itemId];
    if (!values?.trackingId) return;
    setError(null);
    try {
      await api.post(`/stores/${params.storeId}/orders/${params.orderId}/items/${itemId}/tracking`, {
        trackingId: values.trackingId,
        carrier: values.carrier || undefined,
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save tracking for that item.");
    }
  }

  async function markDelivered(itemId: string) {
    setError(null);
    try {
      await api.post(`/stores/${params.storeId}/orders/${params.orderId}/items/${itemId}/deliver`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't mark that item delivered.");
    }
  }

  const address = order.shippingAddress;

  return (
    <div>
      <PageHeader
        title={`Order from ${order.buyerEmail}`}
        description={new Date(order.placedAt).toLocaleString()}
        action={
          <Link href={`/stores/${params.storeId}/orders`}>
            <Button variant="ghost">Back to orders</Button>
          </Link>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardBody className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge tone={statusTone[order.status]}>{order.status === "pending" ? "awaiting payment" : order.status}</Badge>
              <span className="text-xs text-ink-muted">{order.source === "manual" ? "Manually created" : "Placed on storefront"}</span>
            </div>
            {order.status === "pending" && (
              <Button loading={markingPaid} onClick={markAsPaid}>
                Mark as paid
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Items" />
          <CardBody className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{itemLabel(item)}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Qty {item.quantity} · {order.currency} {item.unitPrice} each
                      {item.supplierId && " · supplier-fulfilled"}
                    </p>
                  </div>
                  <Badge tone={item.fulfillmentStatus === "delivered" || item.fulfillmentStatus === "completed" ? "success" : "info"}>
                    {item.fulfillmentStatus}
                  </Badge>
                </div>

                {item.trackingUpdates.length > 0 && (
                  <p className="mt-2 text-xs text-ink-muted">
                    Tracking: {item.trackingUpdates.map((t) => `${t.trackingId}${t.carrier ? ` (${t.carrier})` : ""}`).join(", ")}
                  </p>
                )}

                {item.fulfillmentStatus !== "delivered" && item.fulfillmentStatus !== "completed" && !item.supplierId && (
                  <div className="mt-3 flex items-end gap-2">
                    <Field label="Tracking ID">
                      <Input
                        value={trackingByItem[item.id]?.trackingId ?? ""}
                        onChange={(e) =>
                          setTrackingByItem((prev) => ({ ...prev, [item.id]: { ...prev[item.id], trackingId: e.target.value, carrier: prev[item.id]?.carrier ?? "" } }))
                        }
                      />
                    </Field>
                    <Field label="Carrier (optional)">
                      <Input
                        value={trackingByItem[item.id]?.carrier ?? ""}
                        onChange={(e) =>
                          setTrackingByItem((prev) => ({ ...prev, [item.id]: { trackingId: prev[item.id]?.trackingId ?? "", carrier: e.target.value } }))
                        }
                      />
                    </Field>
                    <Button variant="secondary" onClick={() => uploadTracking(item.id)}>
                      Save tracking
                    </Button>
                    {item.fulfillmentStatus === "shipped" && (
                      <Button variant="secondary" onClick={() => markDelivered(item.id)}>
                        Mark delivered
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-end border-t border-border pt-3 text-sm">
              <div className="w-56 space-y-1">
                <div className="flex justify-between text-ink-muted">
                  <span>Shipping</span>
                  <span>
                    {order.currency} {order.shippingAmount}
                  </span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Tax</span>
                  <span>
                    {order.currency} {order.taxAmount}
                  </span>
                </div>
                {Number(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-ink-muted">
                    <span>Discount</span>
                    <span>
                      -{order.currency} {order.discountAmount}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-medium text-ink">
                  <span>Total</span>
                  <span>
                    {order.currency} {order.totalAmount}
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Shipping address" />
          <CardBody className="text-sm text-ink">
            <p>{address.fullName}</p>
            <p>{address.line1}</p>
            {address.line2 && <p>{address.line2}</p>}
            <p>
              {address.city}, {address.country} {address.postalCode}
            </p>
            <p className="mt-1 text-ink-muted">{address.phone}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tags" description="Your own labels for this order - not shown to the buyer." />
          <CardBody className="flex items-end gap-2">
            <Field label="Comma-separated" hint="e.g. gift, priority">
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </Field>
            <Button variant="secondary" loading={savingTags} onClick={saveTags}>
              Save tags
            </Button>
          </CardBody>
        </Card>

        <Card className="p-4">
          <Disclosure label={`Internal notes (${order.notes.length})`}>
            <form onSubmit={addNote} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Add a note" hint="Only visible to you, never the buyer.">
                  <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={2} />
                </Field>
              </div>
              <Button type="submit" variant="secondary" loading={addingNote}>
                Add
              </Button>
            </form>
            {order.notes.length > 0 && (
              <div className="space-y-2">
                {order.notes.map((note) => (
                  <div key={note.id} className="rounded-md bg-canvas p-3 text-sm text-ink">
                    <p>{note.body}</p>
                    <p className="mt-1 text-xs text-ink-faint">{new Date(note.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Disclosure>
        </Card>

        <Card className="p-4">
          <Disclosure label="Timeline">
            <div className="space-y-1.5 text-sm text-ink-muted">
              {order.timelineEvents.map((event) => (
                <p key={event.id}>
                  {new Date(event.createdAt).toLocaleString()} — {event.eventType.replace(/_/g, " ")}
                </p>
              ))}
            </div>
          </Disclosure>
        </Card>
      </div>
    </div>
  );
}
