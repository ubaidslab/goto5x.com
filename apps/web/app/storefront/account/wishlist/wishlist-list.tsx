"use client";

import { useState } from "react";
import { ResolvedThemeSettings } from "../../../../lib/theme-presets";
import { removeWishlistItemAction, WishlistItem } from "../actions";

/** FR-66.5 (Module 85) - client-side remove with optimistic update; the list itself is server-fetched once on page load. */
export function WishlistList({ items, theme }: { items: WishlistItem[]; theme: ResolvedThemeSettings }) {
  const [list, setList] = useState(items);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function remove(productId: string) {
    setRemovingId(productId);
    const prev = list;
    setList((current) => current.filter((i) => i.productId !== productId));
    const res = await removeWishlistItemAction(productId);
    if (!res.ok) setList(prev);
    setRemovingId(null);
  }

  if (list.length === 0) {
    return <p style={{ fontSize: 14, color: "#6b7280" }}>Nothing saved yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {list.map((item) => (
        <div
          key={item.productId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
          }}
        >
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.title} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
          )}
          <a href={`/products/${item.productId}`} style={{ flex: 1, textDecoration: "none", color: theme.colors.text }}>
            <strong>{item.title}</strong>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
              {item.storeName}
              {item.price !== null && ` - ${item.price.toFixed(2)}`}
            </p>
          </a>
          <button
            onClick={() => remove(item.productId)}
            disabled={removingId === item.productId}
            style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer", fontSize: 13 }}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
