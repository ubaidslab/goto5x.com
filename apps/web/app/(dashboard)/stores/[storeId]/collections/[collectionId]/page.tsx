"use client";

import { useEffect, useState } from "react";

interface CollectionProductEntry {
  productId: string;
  sortOrder: number;
  product: { title: string };
}

export default function ManageCollectionPage({ params }: { params: { storeId: string; collectionId: string } }) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [title, setTitle] = useState("");
  const [entries, setEntries] = useState<CollectionProductEntry[]>([]);
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  function authHeaders() {
    const token = localStorage.getItem("accessToken");
    return { Authorization: `Bearer ${token}` };
  }

  function refresh() {
    fetch(`${apiBase}/stores/${params.storeId}/collections/${params.collectionId}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((c) => {
        setTitle(c.title);
        setEntries(c.products ?? []);
      })
      .catch(() => {});
  }

  useEffect(refresh, [apiBase, params.storeId, params.collectionId]);

  async function onAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(`${apiBase}/stores/${params.storeId}/collections/${params.collectionId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ productId }),
    });
    if (res.ok) {
      setProductId("");
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`Error: ${body.message ?? res.statusText}`);
    }
  }

  async function onRemoveProduct(id: string) {
    await fetch(`${apiBase}/stores/${params.storeId}/collections/${params.collectionId}/products/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    refresh();
  }

  return (
    <main>
      <h1>{title}</h1>
      <form onSubmit={onAddProduct} style={{ display: "flex", gap: 8 }}>
        <input placeholder="Product ID" value={productId} onChange={(e) => setProductId(e.target.value)} required />
        <button type="submit">Add product</button>
      </form>
      {status && <p>{status}</p>}
      <ul>
        {entries.map((entry) => (
          <li key={entry.productId}>
            {entry.product.title}
            <button type="button" onClick={() => onRemoveProduct(entry.productId)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
