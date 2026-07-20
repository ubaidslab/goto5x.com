"use client";

import { useEffect, useState } from "react";

const SLUGS = ["terms", "privacy", "refund", "about", "contact"];

interface ContentPage {
  slug: string;
  title: string;
  bodyHtml: string;
  currentVersion: number;
}

interface BrandAsset {
  kind: string;
  url: string;
  currentVersion: number;
}

const BRAND_ASSET_KINDS = ["logo", "favicon", "hero"];

/**
 * SRS FR-12.1 (versioned platform content pages) + FR-12.3 (platform
 * brand assets, same mechanism). Bare view (no design pass yet) - a plain
 * textarea for rich text is deliberately not a WYSIWYG editor, matching
 * this module's "bare functional" precedent for every other new admin
 * screen.
 */
export default function AdminContentPagesPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [pages, setPages] = useState<Record<string, ContentPage>>({});
  const [drafts, setDrafts] = useState<Record<string, { title: string; bodyHtml: string }>>({});
  const [brandAssets, setBrandAssets] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  function load() {
    fetch(`${apiBase}/admin/content-pages`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((list: ContentPage[]) => {
        const bySlug = Object.fromEntries(list.map((p) => [p.slug, p]));
        setPages(bySlug);
        setDrafts(
          Object.fromEntries(
            SLUGS.map((slug) => [slug, { title: bySlug[slug]?.title ?? "", bodyHtml: bySlug[slug]?.bodyHtml ?? "" }]),
          ),
        );
      });
    fetch(`${apiBase}/admin/brand-assets`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((list: BrandAsset[]) => {
        const byKind = Object.fromEntries(list.map((a) => [a.kind, a.url]));
        setBrandAssets(byKind);
      });
  }

  useEffect(load, [apiBase]);

  async function saveContentPage(slug: string) {
    setStatus(null);
    const draft = drafts[slug];
    const res = await fetch(`${apiBase}/admin/content-pages/${slug}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(draft),
    });
    if (!res.ok) {
      setStatus(`Error saving "${slug}".`);
      return;
    }
    setStatus(`Saved "${slug}".`);
    load();
  }

  async function saveBrandAsset(kind: string) {
    setStatus(null);
    const res = await fetch(`${apiBase}/admin/brand-assets/${kind}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ url: brandAssets[kind] ?? "" }),
    });
    if (!res.ok) {
      setStatus(`Error saving "${kind}".`);
      return;
    }
    setStatus(`Saved "${kind}".`);
  }

  return (
    <main>
      <h1>Content pages &amp; brand assets (bare view - no design pass yet)</h1>
      <p>Edit platform legal/info pages and brand assets - publishing is a data write, never a deploy.</p>
      {status && <p>{status}</p>}

      <h2>Content pages</h2>
      {SLUGS.map((slug) => (
        <div key={slug} style={{ marginBottom: 16 }}>
          <h3>
            {slug} {pages[slug] && <small>(v{pages[slug].currentVersion})</small>}
          </h3>
          <p>
            <label>
              Title{" "}
              <input
                value={drafts[slug]?.title ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [slug]: { ...drafts[slug], title: e.target.value } })}
              />
            </label>
          </p>
          <p>
            <textarea
              rows={6}
              cols={80}
              value={drafts[slug]?.bodyHtml ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [slug]: { ...drafts[slug], bodyHtml: e.target.value } })}
            />
          </p>
          <button onClick={() => saveContentPage(slug)}>Save {slug}</button>
        </div>
      ))}

      <h2>Brand assets</h2>
      {BRAND_ASSET_KINDS.map((kind) => (
        <p key={kind}>
          <label>
            {kind} URL{" "}
            <input
              value={brandAssets[kind] ?? ""}
              onChange={(e) => setBrandAssets({ ...brandAssets, [kind]: e.target.value })}
              style={{ width: 400 }}
            />
          </label>{" "}
          <button onClick={() => saveBrandAsset(kind)}>Save {kind}</button>
        </p>
      ))}
    </main>
  );
}
