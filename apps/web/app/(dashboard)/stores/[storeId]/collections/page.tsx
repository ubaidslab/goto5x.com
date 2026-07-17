"use client";

import { useEffect, useState } from "react";

interface Collection {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
}

export default function CollectionsPage({ params }: { params: { storeId: string } }) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [collections, setCollections] = useState<Collection[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  function authHeaders() {
    const token = localStorage.getItem("accessToken");
    return { Authorization: `Bearer ${token}` };
  }

  function refresh() {
    fetch(`${apiBase}/stores/${params.storeId}/collections`, { headers: authHeaders() })
      .then((res) => res.json())
      .then(setCollections)
      .catch(() => {});
  }

  useEffect(refresh, [apiBase, params.storeId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(`${apiBase}/stores/${params.storeId}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ title, slug }),
    });
    if (res.ok) {
      setTitle("");
      setSlug("");
      refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`Error: ${body.message ?? res.statusText}`);
    }
  }

  return (
    <main>
      <h1>Collections</h1>
      <form onSubmit={onCreate} style={{ display: "flex", gap: 8 }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        <button type="submit">Create</button>
      </form>
      {status && <p>{status}</p>}
      <ul>
        {collections.map((c) => (
          <li key={c.id}>
            <a href={`/stores/${params.storeId}/collections/${c.id}`}>{c.title}</a> ({c.slug})
            {!c.isActive && " - inactive"}
          </li>
        ))}
      </ul>
    </main>
  );
}
