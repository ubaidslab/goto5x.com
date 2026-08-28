"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { adminApi } from "@/lib/admin-api";

interface SearchResult {
  sellers: { id: string; businessName: string; email: string; lifecycleStatus: string }[];
  stores: { id: string; name: string; slug: string; sellerId: string }[];
  orders: { id: string; buyerEmail: string; status: string; totalAmount: number; currency: string; storeId: string }[];
  suppliers: { id: string; businessName: string; email: string }[];
}

/**
 * Phase 6b (Admin Terminal re-skin) - same one-box search across sellers/
 * stores/orders/suppliers (Module 25), restyled onto DashCard. Every result
 * section/field preserved.
 */
export default function AdminSearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const result = await adminApi.get<SearchResult>(`/admin/search?q=${encodeURIComponent(q)}`);
      setResults(result);
    } finally {
      setSearching(false);
    }
  }

  const totalResults = results ? results.sellers.length + results.stores.length + results.orders.length + results.suppliers.length : 0;

  return (
    <div>
      <PageHeader title="Search" description="Find a specific seller, store, order, or supplier by name, email, or ID." />

      <DashCard className="mb-6 max-w-xl">
        <form onSubmit={runSearch} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Search">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, or ID" />
            </Field>
          </div>
          <Button type="submit" loading={searching}>
            Search
          </Button>
        </form>
      </DashCard>

      {results && totalResults === 0 && (
        <DashCard>
          <EmptyState title="No matches" description="Try a different name, email, or ID." />
        </DashCard>
      )}

      {results && totalResults > 0 && (
        <Reveal className="space-y-4" stagger={0.08}>
          {results.sellers.length > 0 && (
            <DashCard>
              <DashCardHeader title={`Sellers (${results.sellers.length})`} />
              <div className="divide-y divide-border">
                {results.sellers.map((s) => (
                  <Link key={s.id} href={`/admin/sellers/${s.id}`} className="flex items-center justify-between gap-4 py-2.5 text-sm transition-smooth-fast hover:opacity-80">
                    <span className="font-medium text-ink">
                      {s.businessName} <span className="font-normal text-ink-muted">· {s.email}</span>
                    </span>
                    <Badge tone="neutral">{s.lifecycleStatus}</Badge>
                  </Link>
                ))}
              </div>
            </DashCard>
          )}

          {results.stores.length > 0 && (
            <DashCard>
              <DashCardHeader title={`Stores (${results.stores.length})`} />
              <div className="divide-y divide-border">
                {results.stores.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="font-medium text-ink">
                      {s.name} <span className="font-normal text-ink-muted">({s.slug})</span>
                    </span>
                    <Link href={`/admin/sellers/${s.sellerId}`} className="text-accent hover:opacity-80">
                      Seller {s.sellerId.slice(0, 8)}
                    </Link>
                  </div>
                ))}
              </div>
            </DashCard>
          )}

          {results.orders.length > 0 && (
            <DashCard>
              <DashCardHeader title={`Orders (${results.orders.length})`} />
              <div className="divide-y divide-border">
                {results.orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="font-medium text-ink">
                      #{o.id.slice(0, 8)} <span className="font-normal text-ink-muted">· {o.buyerEmail}</span>
                    </span>
                    <span className="text-ink-muted">
                      <Badge tone="neutral">{o.status}</Badge>{" "}
                      {o.currency} {o.totalAmount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </DashCard>
          )}

          {results.suppliers.length > 0 && (
            <DashCard>
              <DashCardHeader title={`Suppliers (${results.suppliers.length})`} />
              <div className="divide-y divide-border">
                {results.suppliers.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="font-medium text-ink">{s.businessName}</span>
                    <span className="text-ink-muted">{s.email}</span>
                  </div>
                ))}
              </div>
            </DashCard>
          )}
        </Reveal>
      )}
    </div>
  );
}
