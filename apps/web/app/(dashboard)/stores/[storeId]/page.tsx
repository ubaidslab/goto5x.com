"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { api } from "@/lib/dashboard-api";

interface Product {
  id: string;
}
interface Order {
  id: string;
  status: string;
}

/**
 * Dashboard home - a seller's first screen after picking a store. Answers
 * "what's the state of my store right now?" at a glance (SIMPLICITY
 * INVARIANT rule (a)) and, for a brand-new store with no products yet,
 * leads with the single next action rather than empty stat tiles (rule (e)).
 */
export default function DashboardHomePage({ params }: { params: { storeId: string } }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api.get<Product[]>(`/stores/${params.storeId}/products`).then(setProducts).catch(() => setProducts([]));
    api.get<Order[]>(`/stores/${params.storeId}/orders`).then(setOrders).catch(() => setOrders([]));
  }, [params.storeId]);

  if (products === null || orders === null) return <PageSpinner />;

  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  if (products.length === 0) {
    return (
      <div>
        <PageHeader title="Welcome to your store" description="Let's get your first product live." />
        <Card>
          <CardBody className="flex flex-col items-center gap-4 py-16 text-center">
            <div>
              <h2 className="text-base font-semibold text-ink">Add your first product</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
                Once you add a product with at least one price and quantity, your store is ready to start taking orders.
              </p>
            </div>
            <Link href={`/stores/${params.storeId}/products/new`}>
              <Button>Add a product</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Here's what's happening in your store." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href={`/stores/${params.storeId}/products`}>
          <Card className="transition-smooth hover:shadow-md">
            <CardBody>
              <p className="text-sm text-ink-muted">Products</p>
              <p className="mt-1 text-3xl font-semibold text-ink">{products.length}</p>
            </CardBody>
          </Card>
        </Link>
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">Orders awaiting payment</p>
            <p className="mt-1 text-3xl font-semibold text-ink">{pendingOrders}</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
