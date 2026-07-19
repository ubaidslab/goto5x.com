"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { api } from "@/lib/dashboard-api";

type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | "disputed";

interface Order {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  currency: string;
  placedAt: string;
}

interface CustomerDetail {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpent: string;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  orders: Order[];
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

export default function CustomerDetailPage({ params }: { params: { storeId: string; customerId: string } }) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    api
      .get<CustomerDetail>(`/stores/${params.storeId}/customers/${params.customerId}`)
      .then(setCustomer)
      .catch(() => setCustomer(null));
  }, [params.storeId, params.customerId]);

  if (!customer) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title={customer.name || customer.email}
        description={customer.email}
        action={
          <Link href={`/stores/${params.storeId}/customers`}>
            <Button variant="ghost">Back to customers</Button>
          </Link>
        }
      />

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-ink-muted">Orders</p>
              <p className="mt-1 text-lg font-semibold text-ink">{customer.ordersCount}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Total spent</p>
              <p className="mt-1 text-lg font-semibold text-ink">{customer.totalSpent}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">First order</p>
              <p className="mt-1 text-sm text-ink">{customer.firstOrderAt ? new Date(customer.firstOrderAt).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Last order</p>
              <p className="mt-1 text-sm text-ink">{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : "—"}</p>
            </div>
            {customer.phone && (
              <div>
                <p className="text-xs text-ink-muted">Phone</p>
                <p className="mt-1 text-sm text-ink">{customer.phone}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Order history" description="Every order placed on this store from this email address." />
          {customer.orders.length === 0 ? (
            <CardBody className="text-sm text-ink-muted">No orders yet.</CardBody>
          ) : (
            <div className="divide-y divide-border">
              {customer.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/stores/${params.storeId}/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-smooth-fast hover:bg-canvas"
                >
                  <p className="text-sm text-ink">{new Date(order.placedAt).toLocaleDateString()}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-ink">
                      {order.currency} {order.totalAmount}
                    </p>
                    <Badge tone={statusTone[order.status]}>{order.status === "pending" ? "awaiting payment" : order.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
