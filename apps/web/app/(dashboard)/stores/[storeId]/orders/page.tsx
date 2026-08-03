"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { api } from "@/lib/dashboard-api";

type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | "disputed";
type OrderBucket = "pending" | "awaitingVerification" | "prepaidReceived" | "awaitingTracking" | "shipped" | "delivered" | "cancelledReturned";

interface Order {
  id: string;
  buyerEmail: string;
  status: OrderStatus;
  totalAmount: string;
  currency: string;
  tags: string[];
  placedAt: string;
}

interface OrdersOverview {
  buckets: Record<OrderBucket, number>;
  total: number;
  supplierItemsAwaitingFulfillment: number;
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

const BUCKET_LABELS: { bucket: OrderBucket; label: string }[] = [
  { bucket: "pending", label: "Pending" },
  { bucket: "awaitingVerification", label: "Awaiting verification" },
  { bucket: "prepaidReceived", label: "Prepaid received" },
  { bucket: "awaitingTracking", label: "Awaiting tracking" },
  { bucket: "shipped", label: "Shipped" },
  { bucket: "delivered", label: "Delivered" },
  { bucket: "cancelledReturned", label: "Cancelled / returned" },
];

export default function OrdersListPage({ params }: { params: { storeId: string } }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [overview, setOverview] = useState<OrdersOverview | null>(null);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [bucket, setBucket] = useState<OrderBucket | "">("");

  useEffect(() => {
    api
      .get<OrdersOverview>(`/stores/${params.storeId}/orders/overview`)
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [params.storeId]);

  useEffect(() => {
    const params_ = new URLSearchParams();
    if (status) params_.set("status", status);
    if (bucket) params_.set("bucket", bucket);
    const query = params_.toString() ? `?${params_.toString()}` : "";
    api
      .get<Order[]>(`/stores/${params.storeId}/orders${query}`)
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [params.storeId, status, bucket]);

  function selectBucket(next: OrderBucket) {
    setStatus("");
    setBucket((prev) => (prev === next ? "" : next));
  }

  return (
    <div>
      <PageHeader title="Orders" description="What needs your attention, at a glance, plus every order placed on your store." />

      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BUCKET_LABELS.map(({ bucket: b, label }) => (
            <button
              key={b}
              type="button"
              onClick={() => selectBucket(b)}
              className={`rounded-md border p-3 text-left transition-smooth-fast ${
                bucket === b ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <p className="text-2xl font-semibold text-ink">{overview.buckets[b]}</p>
              <p className="text-xs text-ink-muted">{label}</p>
            </button>
          ))}
          {overview.supplierItemsAwaitingFulfillment > 0 && (
            <p className="col-span-2 self-center text-xs text-ink-muted sm:col-span-4">
              {overview.supplierItemsAwaitingFulfillment} supplier-fulfilled item(s) still awaiting fulfillment.
            </p>
          )}
        </div>
      )}

      <div className="mb-4 max-w-xs">
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => {
              setBucket("");
              setStatus(e.target.value as OrderStatus | "");
            }}
          >
            <option value="">All</option>
            <option value="pending">Awaiting payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="disputed">Disputed</option>
          </Select>
        </Field>
      </div>

      {orders === null ? (
        <PageSpinner />
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState
            title={status || bucket ? "No orders match this filter" : "No orders yet"}
            description={
              status || bucket ? "Try a different filter." : "Orders placed on your storefront (or added manually) will show up here."
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/stores/${params.storeId}/orders/${order.id}`}
              className="flex items-center justify-between gap-4 px-6 py-4 transition-smooth-fast hover:bg-canvas"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{order.buyerEmail}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {new Date(order.placedAt).toLocaleDateString()} · {order.currency} {order.totalAmount}
                  {order.tags.length > 0 && ` · ${order.tags.join(", ")}`}
                </p>
              </div>
              <Badge tone={statusTone[order.status]}>{order.status === "pending" ? "awaiting payment" : order.status}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
