"use client";

import { useEffect, useState } from "react";
import { PublicProduct, PublicStore } from "@/lib/storefront-api";
import { FaqItem, resolveThemeSettings, SectionId, ThemeSettings } from "@/lib/theme-presets";
import { AboutSection, FaqSection, FeaturedProductsSection, HeroSection, NewsletterSection } from "@/app/storefront/sections";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

interface Theme {
  id: string;
  name: string;
  tier: "free" | "premium" | "marketplace";
  entitled: boolean;
}

const SECTION_LABELS: Record<SectionId, string> = {
  hero: "Hero banner",
  featured_products: "Featured products",
  about: "About",
  newsletter: "Newsletter signup",
  faq: "FAQ",
};

/**
 * SRS FR-1.2 (v1.0 bounded token set)/FR-1.3 (live preview). Colors + a
 * fixed set of sections (show/hide + reorder) - no code editor here, no
 * animation controls (FR-1.7 is Phase 3). Preview re-renders the identical
 * section components the real storefront uses (app/storefront/sections.tsx)
 * against this page's in-progress, unsaved local state, so "live preview
 * output matches published output exactly" (§14.1) by construction, not by
 * coincidence - it is the same code. The preview pane deliberately does not
 * pick up this module's dashboard design system - it must look like the
 * live storefront, which is a separate, seller-configured visual system.
 */
export default function CustomizerPage({ params }: { params: { storeId: string } }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [store, setStore] = useState<{ id: string; name: string; slug: string; accessMode: PublicStore["accessMode"] } | null>(
    null,
  );
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [themeId, setThemeId] = useState("");
  const [settings, setSettings] = useState<ThemeSettings>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showcaseUrl, setShowcaseUrl] = useState<string | null>(null);

  useEffect(() => {
    api.get<Theme[]>("/themes").then(setThemes).catch(() => {});
    // FR-24.1/24.2 - null (v1.0 default, no Template Store yet) hides this
    // panel entirely - the built-in theme catalog above has no dependency on it.
    api.get<{ url: string | null }>("/themes/template-store-showcase-url").then((r) => setShowcaseUrl(r.url)).catch(() => {});

    api
      .get<{ id: string; name: string; slug: string; accessMode: PublicStore["accessMode"] }>(`/stores/${params.storeId}`)
      .then((s) => setStore({ id: s.id, name: s.name, slug: s.slug, accessMode: s.accessMode }))
      .catch(() => {});

    api
      .get<{ themeId: string; settings: ThemeSettings }>(`/stores/${params.storeId}/theme-settings`)
      .then((ts) => {
        setThemeId(ts.themeId);
        setSettings(ts.settings ?? {});
      })
      .catch(() => {});

    api
      .get<Array<{ id: string; title: string; description: string | null; averageRating: string; reviewCount: number; variants?: unknown[]; seoTitle?: string; seoDescription?: string | null }>>(
        `/stores/${params.storeId}/products`,
      )
      .then((list) =>
        setProducts(
          list.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            averageRating: p.averageRating,
            reviewCount: p.reviewCount,
            variants: (p.variants ?? []) as PublicProduct["variants"],
            media: [],
            seoTitle: p.seoTitle ?? p.title,
            seoDescription: p.seoDescription ?? null,
          })),
        ),
      )
      .catch(() => {});
  }, [params.storeId]);

  const themeName = themes.find((t) => t.id === themeId)?.name ?? "Classic";
  const resolved = resolveThemeSettings(themeName, settings);

  function moveSection(index: number, direction: -1 | 1) {
    const current = resolved.sections.slice();
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    setSettings({ ...settings, sections: current });
  }

  function toggleSection(index: number) {
    const current = resolved.sections.slice();
    current[index] = { ...current[index], visible: !current[index].visible };
    setSettings({ ...settings, sections: current });
  }

  function setColor(key: "primary" | "background" | "text", value: string) {
    setSettings({ ...settings, colors: { ...resolved.colors, [key]: value } });
  }

  function setAnnouncementBar(enabled: boolean, message: string) {
    setSettings({ ...settings, announcementBar: { enabled, message } });
  }

  function setWhatsapp(enabled: boolean, phoneNumber: string) {
    setSettings({ ...settings, whatsapp: { enabled, phoneNumber } });
  }

  function updateFaqItems(items: FaqItem[]) {
    setSettings({ ...settings, faqItems: items });
  }

  function addFaqItem() {
    updateFaqItems([...resolved.faqItems, { question: "", answer: "" }]);
  }

  function updateFaqItem(index: number, field: "question" | "answer", value: string) {
    const items = resolved.faqItems.slice();
    items[index] = { ...items[index], [field]: value };
    updateFaqItems(items);
  }

  function removeFaqItem(index: number) {
    updateFaqItems(resolved.faqItems.filter((_, i) => i !== index));
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.patch(`/stores/${params.storeId}/theme-settings`, { themeId, settings });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save theme settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!store) return <PageSpinner />;

  const previewStore: PublicStore = {
    id: store.id,
    name: store.name,
    slug: store.slug,
    currency: "PKR",
    accessMode: store.accessMode,
    canonicalHostname: `${store.slug}.goto5x.com`,
    seoTitle: store.name,
    seoDescription: null,
    logoUrl: null,
    theme: { name: themeName, settings: settings as Record<string, unknown> },
  };

  return (
    <div>
      <PageHeader title={`Customize ${store.name}`} />

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}

      <div className="grid grid-cols-[360px_1fr] gap-6">
        <div className="space-y-4">
          <Card>
            <CardBody>
              <Field label="Theme">
                <Select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
                  {themes.map((t) => (
                    <option key={t.id} value={t.id} disabled={!t.entitled}>
                      {t.name}
                      {t.tier === "marketplace" ? (t.entitled ? " (licensed)" : " (locked - purchase required)") : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          {showcaseUrl && (
            <Card>
              <CardHeader title="Premium templates" />
              <CardBody>
                <p className="text-sm text-muted-foreground">
                  Browse professionally designed premium templates in the Template Store.
                </p>
                <a href={showcaseUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary">Browse Template Store &rarr;</Button>
                </a>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Colors" />
            <CardBody className="grid grid-cols-3 gap-3">
              <Field label="Primary">
                <input type="color" value={resolved.colors.primary} onChange={(e) => setColor("primary", e.target.value)} className="h-10 w-full rounded-md border border-border" />
              </Field>
              <Field label="Background">
                <input type="color" value={resolved.colors.background} onChange={(e) => setColor("background", e.target.value)} className="h-10 w-full rounded-md border border-border" />
              </Field>
              <Field label="Text">
                <input type="color" value={resolved.colors.text} onChange={(e) => setColor("text", e.target.value)} className="h-10 w-full rounded-md border border-border" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Sections" description="Show/hide and reorder." />
            <CardBody className="space-y-1">
              {resolved.sections.map((section, index) => (
                <div key={section.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-canvas">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={section.visible} onChange={() => toggleSection(index)} />
                    {SECTION_LABELS[section.id]}
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveSection(index, -1)}
                      disabled={index === 0}
                      className="rounded px-1.5 py-0.5 text-xs text-ink-muted transition-smooth-fast hover:bg-surface-raised disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(index, 1)}
                      disabled={index === resolved.sections.length - 1}
                      className="rounded px-1.5 py-0.5 text-xs text-ink-muted transition-smooth-fast hover:bg-surface-raised disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Announcement bar" />
            <CardBody className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={resolved.announcementBar?.enabled ?? false}
                  onChange={(e) => setAnnouncementBar(e.target.checked, resolved.announcementBar?.message ?? "")}
                />
                Enabled
              </label>
              <Input
                placeholder="Message"
                value={resolved.announcementBar?.message ?? ""}
                onChange={(e) => setAnnouncementBar(resolved.announcementBar?.enabled ?? false, e.target.value)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="WhatsApp button" />
            <CardBody className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={resolved.whatsapp?.enabled ?? false}
                  onChange={(e) => setWhatsapp(e.target.checked, resolved.whatsapp?.phoneNumber ?? "")}
                />
                Enabled
              </label>
              <Input
                placeholder="+92300..."
                value={resolved.whatsapp?.phoneNumber ?? ""}
                onChange={(e) => setWhatsapp(resolved.whatsapp?.enabled ?? false, e.target.value)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="FAQ" />
            <CardBody className="space-y-3">
              {resolved.faqItems.map((item, index) => (
                <div key={index} className="space-y-2 rounded-md border border-border p-3">
                  <Input placeholder="Question" value={item.question} onChange={(e) => updateFaqItem(index, "question", e.target.value)} />
                  <Input placeholder="Answer" value={item.answer} onChange={(e) => updateFaqItem(index, "answer", e.target.value)} />
                  <Button variant="ghost" size="sm" onClick={() => removeFaqItem(index)}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="secondary" onClick={addFaqItem}>
                Add question
              </Button>
            </CardBody>
          </Card>

          <Button loading={saving} onClick={onSave}>
            Save
          </Button>
        </div>

        <div className="rounded-md border border-border">
          {resolved.sections
            .filter((section) => section.visible)
            .map((section) => {
              switch (section.id) {
                case "hero":
                  return <HeroSection key={section.id} store={previewStore} theme={resolved} />;
                case "featured_products":
                  return <FeaturedProductsSection key={section.id} products={products} theme={resolved} />;
                case "about":
                  return <AboutSection key={section.id} store={previewStore} theme={resolved} />;
                case "newsletter":
                  return <NewsletterSection key={section.id} theme={resolved} />;
                case "faq":
                  return <FaqSection key={section.id} theme={resolved} items={resolved.faqItems} />;
                default:
                  return null;
              }
            })}
        </div>
      </div>
    </div>
  );
}
