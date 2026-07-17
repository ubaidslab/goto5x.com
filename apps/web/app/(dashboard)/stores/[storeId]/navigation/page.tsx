"use client";

import { useEffect, useState } from "react";
import { NavigationItem } from "../../../../../lib/storefront-api";

type Location = "header" | "footer";

const EMPTY_ITEM: NavigationItem = { type: "link", label: "", targetType: "external", url: "" };

/**
 * SRS FR-16.3. One flat list per location, saved with a single PUT - the
 * API replaces the whole `items` array on each save (no per-item CRUD
 * endpoints), matching how store_navigation_menus is one row per
 * (store, location), not a table of individual rows.
 */
export default function NavigationEditorPage({ params }: { params: { storeId: string } }) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [location, setLocation] = useState<Location>("header");
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    fetch(`${apiBase}/stores/${params.storeId}/navigation/${location}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((menu) => setItems(menu.items ?? []))
      .catch(() => {});
  }, [apiBase, params.storeId, location]);

  function updateItem(index: number, patch: Partial<NavigationItem>) {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    setItems(next);
  }

  function addItem() {
    setItems([...items, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function onSave() {
    setStatus(null);
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`${apiBase}/stores/${params.storeId}/navigation/${location}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items }),
    });
    setStatus(res.ok ? "Saved." : "Error saving.");
  }

  return (
    <main>
      <h1>Navigation</h1>
      <label>
        <input type="radio" checked={location === "header"} onChange={() => setLocation("header")} />
        Header
      </label>
      <label>
        <input type="radio" checked={location === "footer"} onChange={() => setLocation("footer")} />
        Footer
      </label>

      {items.map((item, index) => (
        <div key={index} style={{ border: "1px solid #e5e7eb", padding: 8, marginTop: 8 }}>
          <select value={item.type} onChange={(e) => updateItem(index, { type: e.target.value as NavigationItem["type"] })}>
            <option value="link">Link</option>
            <option value="text_block">Text block</option>
            <option value="social_links">Social links</option>
          </select>

          {item.type === "link" && (
            <>
              <input
                type="text"
                placeholder="Label"
                value={item.label ?? ""}
                onChange={(e) => updateItem(index, { label: e.target.value })}
              />
              <select
                value={item.targetType ?? "external"}
                onChange={(e) => updateItem(index, { targetType: e.target.value as NavigationItem["targetType"] })}
              >
                <option value="external">External URL</option>
                <option value="collection">Collection</option>
                <option value="content_page">Content page</option>
              </select>
              {item.targetType === "external" ? (
                <input
                  type="text"
                  placeholder="https://..."
                  value={item.url ?? ""}
                  onChange={(e) => updateItem(index, { url: e.target.value })}
                />
              ) : (
                <input
                  type="text"
                  placeholder="Target ID"
                  value={item.targetId ?? ""}
                  onChange={(e) => updateItem(index, { targetId: e.target.value })}
                />
              )}
            </>
          )}

          {item.type === "text_block" && (
            <input
              type="text"
              placeholder="Free text"
              value={typeof item.body === "string" ? item.body : ""}
              onChange={(e) => updateItem(index, { body: e.target.value })}
            />
          )}

          {item.type === "social_links" && (
            <>
              {(["facebook", "instagram", "tiktok", "twitter"] as const).map((platform) => {
                const body = (typeof item.body === "object" ? item.body : {}) as Record<string, string>;
                return (
                  <input
                    key={platform}
                    type="text"
                    placeholder={platform}
                    value={body[platform] ?? ""}
                    onChange={(e) => updateItem(index, { body: { ...body, [platform]: e.target.value } })}
                  />
                );
              })}
            </>
          )}

          <button type="button" onClick={() => removeItem(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem}>
        Add item
      </button>
      <div>
        <button type="button" onClick={onSave}>
          Save
        </button>
        {status && <p>{status}</p>}
      </div>
    </main>
  );
}
