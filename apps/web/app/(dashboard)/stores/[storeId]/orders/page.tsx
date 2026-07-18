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

interface Order {
  id: string;
  buyerEmail: string;
  status: OrderStatus;
  totalAmount: string;
  currency: string;
  tags: string[];
  placedAt: string;
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

export default function OrdersListPage({ params }: { params: { storeId: string } }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [status, setStatus] = useState<OrderStatus | "">("");

  useEffect(() => {
    const query = status ? `?status=${status}` : "";
    api
      .get<Order[]>(`/stores/${params.storeId}/orders${query}`)
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [params.storeId, status]);

  return (
    <div>
      <PageHeader title="Orders" description="Every order placed on your store, regardless of payment status." />

      <div className="mb-4 max-w-xs">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")}>
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
            title={status ? "No orders with this status" : "No orders yet"}
            description={status ? "Try a different status filter." : "Orders placed on your storefront (or added manually) will show up here."}
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
