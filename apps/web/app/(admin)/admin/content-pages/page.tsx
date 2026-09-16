"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";

const SLUGS = ["terms", "privacy", "refund", "about", "contact"];
const BRAND_ASSET_KINDS = ["logo", "favicon", "hero"];
// Founder walkthrough finding (Phase 1 item 10) - footer social links reuse this
// same brand-assets mechanism (SRS FR-12.3) rather than a new settings surface;
// MarketingFooter.tsx reads these same 4 kinds and only renders a link when set.
const SOCIAL_LINK_KINDS: { kind: string; label: string }[] = [
  { kind: "social_linkedin", label: "LinkedIn" },
  { kind: "social_facebook", label: "Facebook" },
  { kind: "social_instagram", label: "Instagram" },
  { kind: "social_tiktok", label: "TikTok" },
];

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

/**
 * Phase 6g (Admin Terminal re-skin) - SRS FR-12.1 (versioned platform
 * content pages) + FR-12.3 (platform brand assets, same mechanism),
 * restyled onto DashCard. Every action preserved: per-slug title/body edit
 * + save, per-kind brand asset URL edit + save. Converted from hand-rolled
 * fetch/authHeaders to adminApi.
 */
export default function AdminContentPagesPage() {
  const [pages, setPages] = useState<Record<string, ContentPage>>({});
  const [drafts, setDrafts] = useState<Record<string, { title: string; bodyHtml: string }>>({});
  const [brandAssets, setBrandAssets] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    Promise.all([
      adminApi.get<ContentPage[]>("/admin/content-pages"),
      adminApi.get<BrandAsset[]>("/admin/brand-assets"),
    ])
      .then(([pageList, assetList]) => {
        const bySlug = Object.fromEntries(pageList.map((p) => [p.slug, p]));
        setPages(bySlug);
        setDrafts(
          Object.fromEntries(SLUGS.map((slug) => [slug, { title: bySlug[slug]?.title ?? "", bodyHtml: bySlug[slug]?.bodyHtml ?? "" }])),
        );
        setBrandAssets(Object.fromEntries(assetList.map((a) => [a.kind, a.url])));
        setLoaded(true);
      })
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load content pages."));
  }

  useEffect(load, []);

  async function saveContentPage(slug: string) {
    setStatus(null);
    setError(null);
    try {
      await adminApi.put(`/admin/content-pages/${slug}`, drafts[slug]);
      setStatus(`Saved "${slug}".`);
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : `Couldn't save "${slug}".`);
    }
  }

  async function saveBrandAsset(kind: string) {
    setStatus(null);
    setError(null);
    try {
      await adminApi.put(`/admin/brand-assets/${kind}`, { url: brandAssets[kind] ?? "" });
      setStatus(`Saved "${kind}".`);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : `Couldn't save "${kind}".`);
    }
  }

  if (!loaded && !error) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Content pages & brand assets"
        description="Platform legal/info pages and brand assets - publishing is a data write, never a deploy."
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {status && <Alert tone="success">{status}</Alert>}

      <div className="max-w-3xl space-y-4">
        <DashCard className="divide-y divide-border">
          <Reveal stagger={0.04}>
          {SLUGS.map((slug) => (
            <div key={slug} className="space-y-3 py-4 first:pt-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">{slug}</h3>
                {pages[slug] && <Badge tone="neutral">v{pages[slug].currentVersion}</Badge>}
              </div>
              <Field label="Title">
                <Input
                  value={drafts[slug]?.title ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [slug]: { ...drafts[slug], title: e.target.value } })}
                />
              </Field>
              <Field label="Body (HTML)">
                <Textarea
                  rows={6}
                  className="font-mono text-xs"
                  value={drafts[slug]?.bodyHtml ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [slug]: { ...drafts[slug], bodyHtml: e.target.value } })}
                />
              </Field>
              <Button size="sm" onClick={() => saveContentPage(slug)}>
                Save {slug}
              </Button>
            </div>
          ))}
          </Reveal>
        </DashCard>

        <DashCard>
          <DashCardHeader title="Brand assets" />
          <Reveal className="space-y-3" stagger={0.04}>
            {BRAND_ASSET_KINDS.map((kind) => (
              <div key={kind} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[16rem] flex-1">
                  <Field label={`${kind} URL`}>
                    <Input value={brandAssets[kind] ?? ""} onChange={(e) => setBrandAssets({ ...brandAssets, [kind]: e.target.value })} />
                  </Field>
                </div>
                <Button size="sm" onClick={() => saveBrandAsset(kind)}>
                  Save {kind}
                </Button>
              </div>
            ))}
          </Reveal>
        </DashCard>

        <DashCard>
          <DashCardHeader title="Social links" />
          <p className="mb-4 text-sm text-ink-muted">
            Shown in the platform footer. Leave blank to hide a network - the footer never shows a dead link.
          </p>
          <Reveal className="space-y-3" stagger={0.04}>
            {SOCIAL_LINK_KINDS.map(({ kind, label }) => (
              <div key={kind} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[16rem] flex-1">
                  <Field label={`${label} URL`}>
                    <Input value={brandAssets[kind] ?? ""} onChange={(e) => setBrandAssets({ ...brandAssets, [kind]: e.target.value })} />
                  </Field>
                </div>
                <Button size="sm" onClick={() => saveBrandAsset(kind)}>
                  Save {label}
                </Button>
              </div>
            ))}
          </Reveal>
        </DashCard>
      </div>
    </div>
  );
}
