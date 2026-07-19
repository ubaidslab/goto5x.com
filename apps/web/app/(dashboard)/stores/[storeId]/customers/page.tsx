"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { api } from "@/lib/dashboard-api";

type CustomerSort = "total_spent" | "orders_count" | "last_order_at";

interface Customer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpent: string;
  lastOrderAt: string | null;
}

export default function CustomersListPage({ params }: { params: { storeId: string } }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CustomerSort>("total_spent");

  useEffect(() => {
    const query = new URLSearchParams({ sort, ...(search ? { search } : {}) });
    api
      .get<Customer[]>(`/stores/${params.storeId}/customers?${query.toString()}`)
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, [params.storeId, search, sort]);

  return (
    <div>
      <PageHeader title="Customers" description="Everyone who has bought from your store, by email." />

      <div className="mb-4 flex max-w-xl gap-3">
        <div className="flex-1">
          <Field label="Search">
            <Input placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
        </div>
        <div className="w-56">
          <Field label="Sort by">
            <Select value={sort} onChange={(e) => setSort(e.target.value as CustomerSort)}>
              <option value="total_spent">Total spent</option>
              <option value="orders_count">Order count</option>
              <option value="last_order_at">Most recent order</option>
            </Select>
          </Field>
        </div>
      </div>

      {customers === null ? (
        <PageSpinner />
      ) : customers.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? "No customers match that search" : "No customers yet"}
            description={search ? "Try a different name or email." : "A customer record appears here the first time someone checks out."}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              href={`/stores/${params.storeId}/customers/${customer.id}`}
              className="flex items-center justify-between gap-4 px-6 py-4 transition-smooth-fast hover:bg-canvas"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{customer.name || customer.email}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {customer.email} · {customer.ordersCount} order{customer.ordersCount === 1 ? "" : "s"}
                  {customer.lastOrderAt && ` · last order ${new Date(customer.lastOrderAt).toLocaleDateString()}`}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium text-ink">{customer.totalSpent}</p>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
