"use client";

import { useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/admin-api";

interface SearchResult {
  sellers: { id: string; businessName: string; email: string; lifecycleStatus: string }[];
  stores: { id: string; name: string; slug: string; sellerId: string }[];
  orders: { id: string; buyerEmail: string; status: string; totalAmount: number; currency: string; storeId: string }[];
  suppliers: { id: string; businessName: string; email: string }[];
}

/**
 * Module 25 (Admin Completion) - one search box across sellers/stores/
 * orders/suppliers by partial name/email/ID (§14 gap: no way to find a
 * specific record without direct DB access).
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

  return (
    <main>
      <h1>Search</h1>
      <form onSubmit={runSearch}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, email, or ID"
          style={{ width: 300 }}
        />
        <button type="submit" disabled={searching}>
          Search
        </button>
      </form>

      {results && (
        <>
          <h2>Sellers ({results.sellers.length})</h2>
          <ul>
            {results.sellers.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/sellers/${s.id}`}>{s.businessName}</Link> - {s.email} - {s.lifecycleStatus}
              </li>
            ))}
          </ul>

          <h2>Stores ({results.stores.length})</h2>
          <ul>
            {results.stores.map((s) => (
              <li key={s.id}>
                {s.name} ({s.slug}) - seller{" "}
                <Link href={`/admin/sellers/${s.sellerId}`}>{s.sellerId.slice(0, 8)}</Link>
              </li>
            ))}
          </ul>

          <h2>Orders ({results.orders.length})</h2>
          <ul>
            {results.orders.map((o) => (
              <li key={o.id}>
                {o.id.slice(0, 8)} - {o.buyerEmail} - {o.status} - {o.currency} {o.totalAmount.toFixed(2)}
              </li>
            ))}
          </ul>

          <h2>Suppliers ({results.suppliers.length})</h2>
          <ul>
            {results.suppliers.map((s) => (
              <li key={s.id}>
                {s.businessName} - {s.email}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
