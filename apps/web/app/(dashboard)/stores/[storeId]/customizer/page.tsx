"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PublicProduct, PublicStore } from "@/lib/storefront-api";
import { FaqItem, resolveThemeSettings, SectionId, ThemeSettings } from "@/lib/theme-presets";
import { getTemplateSections } from "@/app/storefront/templates/registry";
import { Reveal } from "@/components/motion/Reveal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { UpgradeLockedCard } from "@/components/ui/UpgradeLockedCard";
import { toast } from "@/lib/use-toast";
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
  const [branding, setBranding] = useState<{ removable: boolean; hidden: boolean; visible: boolean } | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [codedModeEnabled, setCodedModeEnabled] = useState<boolean | null>(null);
  const [savingCode, setSavingCode] = useState(false);

  function loadBranding() {
    api
      .get<{ removable: boolean; hidden: boolean; visible: boolean }>(`/stores/${params.storeId}/branding`)
      .then(setBranding)
      .catch(() => setBranding(null));
  }

  async function toggleBranding(hidden: boolean) {
    setError(null);
    setSavingBranding(true);
    try {
      const updated = await api.patch<{ removable: boolean; hidden: boolean; visible: boolean }>(`/stores/${params.storeId}/branding`, { hidden });
      setBranding(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update your storefront branding.");
    } finally {
      setSavingBranding(false);
    }
  }

  useEffect(loadBranding, [params.storeId]);

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
      .get<{ themeId: string; settings: ThemeSettings; customCode: string | null; codedModeEnabled: boolean }>(
        `/stores/${params.storeId}/theme-settings`,
      )
      .then((ts) => {
        setThemeId(ts.themeId);
        setSettings(ts.settings ?? {});
        setCustomCode(ts.customCode ?? "");
        setCodedModeEnabled(ts.codedModeEnabled);
      })
      .catch(() => {});

    api
      .get<{
        items: Array<{ id: string; title: string; description: string | null; averageRating: string; reviewCount: number; variants?: unknown[]; seoTitle?: string; seoDescription?: string | null }>;
      }>(`/stores/${params.storeId}/products?limit=100`)
      .then((page) =>
        setProducts(
          page.items.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            averageRating: p.averageRating,
            reviewCount: p.reviewCount,
            variants: (p.variants ?? []) as PublicProduct["variants"],
            media: [],
            seoTitle: p.seoTitle ?? p.title,
            seoDescription: p.seoDescription ?? null,
            // Module 58 (SRS §5.65) - this preview pulls from the seller-
            // side products API (unresolved raw fields), not the storefront
            // read path that actually resolves the advanced-SEO cascade;
            // sensible unresolved defaults here since this panel doesn't
            // render SEO/robots/OG data at all.
            canonicalUrl: null,
            robotsIndex: true,
            robotsFollow: true,
            ogImageUrl: null,
            ogTitle: p.seoTitle ?? p.title,
            ogDescription: p.seoDescription ?? null,
            structuredDataEnabled: true,
            sitemapIncluded: true,
            slug: null,
            // This preview pulls from the seller-side products API, not the
            // storefront read path that actually computes supplier
            // transparency (Module 8/29) - null is the correct "no data
            // fetched for this" value here, not a misrepresentation.
            supplierShipping: null,
          })),
        ),
      )
      .catch(() => {});
  }, [params.storeId]);

  const themeName = themes.find((t) => t.id === themeId)?.name ?? "Editorial";
  const resolved = resolveThemeSettings(themeName, settings);
  const sections = getTemplateSections(themeName);

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

  async function saveCustomCode() {
    setError(null);
    setSavingCode(true);
    try {
      await api.patch(`/stores/${params.storeId}/theme-settings`, { customCode });
      toast({ tone: "success", title: "Custom code saved" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your custom code.");
    } finally {
      setSavingCode(false);
    }
  }

  if (!store) return <PageSpinner />;

  const previewStore: PublicStore = {
    id: store.id,
    name: store.name,
    slug: store.slug,
    currency: "PKR",
    accessMode: store.accessMode,
    canonicalHostname: `${store.slug}.uzeyn.com`,
    seoTitle: store.name,
    seoDescription: null,
    logoUrl: null,
    verified: false,
    poweredByVisible: branding?.visible ?? true,
    theme: { name: themeName, settings: settings as Record<string, unknown> },
    // Module 58 (SRS §5.65) - this preview panel doesn't render SEO/robots/
    // custom head-tag data, so the platform defaults are correct here.
    seoRobotsIndexDefault: true,
    seoRobotsFollowDefault: true,
    seoStructuredDataDefault: true,
    seoSitemapIncludedDefault: true,
    customHeadTags: null,
  };

  return (
    <div>
      <PageHeader
        title={`Customize ${store.name}`}
        description="Pick a theme, adjust colors and sections, and preview changes before saving."
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}

      <div className="grid grid-cols-[360px_1fr] gap-6">
        <Reveal stagger={0.05} className="space-y-4">
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
            <CardHeader title="Storefront branding" description="The 'Managed by UZEYN' mark shown on your storefront." />
            <CardBody className="space-y-3">
              {branding && (
                <>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={branding.hidden}
                      disabled={!branding.removable || savingBranding}
                      onChange={(e) => toggleBranding(e.target.checked)}
                    />
                    Hide the &quot;Managed by UZEYN&quot; mark
                  </label>
                  {!branding.removable && (
                    <p className="text-xs text-ink-muted">
                      Only removable on the Pro plan (or any Team plan). Upgrade to remove it.
                    </p>
                  )}
                </>
              )}
            </CardBody>
          </Card>

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
                      aria-label={`Move ${SECTION_LABELS[section.id]} up`}
                      className="rounded p-1 text-ink-muted transition-smooth-fast hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(index, 1)}
                      disabled={index === resolved.sections.length - 1}
                      aria-label={`Move ${SECTION_LABELS[section.id]} down`}
                      className="rounded p-1 text-ink-muted transition-smooth-fast hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
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
            <CardHeader title="Coded mode" description="A raw-code escape hatch beyond what the controls above can express." />
            {codedModeEnabled === null ? (
              <CardBody>
                <PageSpinner />
              </CardBody>
            ) : codedModeEnabled ? (
              <CardBody className="space-y-3">
                <Alert tone="warning">
                  Saved here, but not yet rendered on your live storefront in this release - there is no execution path for it yet.
                  Use this as a staging area; nothing you write here is visible to buyers today.
                </Alert>
                <Textarea
                  rows={8}
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="<style>/* or <script> - not yet executed on your storefront */</style>"
                  className="font-mono text-xs"
                />
                <Button variant="secondary" loading={savingCode} onClick={saveCustomCode}>
                  Save code
                </Button>
              </CardBody>
            ) : (
              <UpgradeLockedCard
                requiredTier="RISE"
                title="Coded mode is a RISE+ feature"
                description="Write raw HTML/CSS/JS beyond what the theme controls above can express, once you're on RISE or FLY."
                action={
                  <Link href={`/stores/${params.storeId}/billing`}>
                    <Button size="sm" variant="secondary">
                      View plans
                    </Button>
                  </Link>
                }
              />
            )}
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
        </Reveal>

        <div className="rounded-md border border-border">
          {resolved.sections
            .filter((section) => section.visible)
            .map((section) => {
              switch (section.id) {
                case "hero":
                  return <sections.Hero key={section.id} store={previewStore} theme={resolved} />;
                case "featured_products":
                  return <sections.FeaturedProducts key={section.id} products={products} theme={resolved} />;
                case "about":
                  return <sections.About key={section.id} store={previewStore} theme={resolved} />;
                case "newsletter":
                  return <sections.Newsletter key={section.id} theme={resolved} />;
                case "faq":
                  return <sections.Faq key={section.id} theme={resolved} items={resolved.faqItems} />;
                default:
                  return null;
              }
            })}
        </div>
      </div>
    </div>
  );
}
