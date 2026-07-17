"use client";

import { useEffect, useState } from "react";
import { PublicProduct, PublicStore } from "../../../../../lib/storefront-api";
import { FaqItem, resolveThemeSettings, SectionId, ThemeSettings } from "../../../../../lib/theme-presets";
import { AboutSection, FaqSection, FeaturedProductsSection, HeroSection, NewsletterSection } from "../../../../storefront/sections";

interface Theme {
  id: string;
  name: string;
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
 * coincidence - it is the same code.
 */
export default function CustomizerPage({ params }: { params: { storeId: string } }) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [themes, setThemes] = useState<Theme[]>([]);
  const [store, setStore] = useState<{ id: string; name: string; slug: string; accessMode: PublicStore["accessMode"] } | null>(
    null,
  );
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [themeId, setThemeId] = useState("");
  const [settings, setSettings] = useState<ThemeSettings>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${apiBase}/themes`, { headers })
      .then((res) => res.json())
      .then(setThemes)
      .catch(() => {});

    fetch(`${apiBase}/stores/${params.storeId}`, { headers })
      .then((res) => res.json())
      .then((s) => setStore({ id: s.id, name: s.name, slug: s.slug, accessMode: s.accessMode }))
      .catch(() => {});

    fetch(`${apiBase}/stores/${params.storeId}/theme-settings`, { headers })
      .then((res) => res.json())
      .then((ts) => {
        setThemeId(ts.themeId);
        setSettings((ts.settings as ThemeSettings) ?? {});
      })
      .catch(() => {});

    fetch(`${apiBase}/stores/${params.storeId}/products`, { headers })
      .then((res) => res.json())
      .then((list) =>
        setProducts(
          list.map((p: any) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            averageRating: p.averageRating,
            reviewCount: p.reviewCount,
            variants: p.variants ?? [],
            media: [],
            seoTitle: p.seoTitle ?? p.title,
            seoDescription: p.seoDescription ?? null,
          })),
        ),
      )
      .catch(() => {});
  }, [apiBase, params.storeId]);

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
    setStatus(null);
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`${apiBase}/stores/${params.storeId}/theme-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ themeId, settings }),
    });
    if (res.ok) {
      setStatus("Saved.");
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`Error: ${body.message ?? res.statusText}`);
    }
  }

  if (!store) return <main>Loading…</main>;

  const previewStore: PublicStore = {
    id: store.id,
    name: store.name,
    slug: store.slug,
    currency: "PKR",
    accessMode: store.accessMode,
    canonicalHostname: `${store.slug}.goto5x.com`,
    seoTitle: store.name,
    seoDescription: null,
    theme: { name: themeName, settings: settings as Record<string, unknown> },
  };

  return (
    <main style={{ maxWidth: "none", display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
      <div>
        <h1>Customize {store.name}</h1>

        <label>
          Theme
          <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>Colors</legend>
          <label>
            Primary
            <input type="color" value={resolved.colors.primary} onChange={(e) => setColor("primary", e.target.value)} />
          </label>
          <label>
            Background
            <input type="color" value={resolved.colors.background} onChange={(e) => setColor("background", e.target.value)} />
          </label>
          <label>
            Text
            <input type="color" value={resolved.colors.text} onChange={(e) => setColor("text", e.target.value)} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Sections (show/hide, reorder)</legend>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {resolved.sections.map((section, index) => (
              <li key={section.id}>
                <label>
                  <input type="checkbox" checked={section.visible} onChange={() => toggleSection(index)} />
                  {SECTION_LABELS[section.id]}
                </label>
                <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0}>
                  ↑
                </button>
                <button type="button" onClick={() => moveSection(index, 1)} disabled={index === resolved.sections.length - 1}>
                  ↓
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset>
          <legend>Announcement bar</legend>
          <label>
            <input
              type="checkbox"
              checked={resolved.announcementBar?.enabled ?? false}
              onChange={(e) => setAnnouncementBar(e.target.checked, resolved.announcementBar?.message ?? "")}
            />
            Enabled
          </label>
          <input
            type="text"
            placeholder="Message"
            value={resolved.announcementBar?.message ?? ""}
            onChange={(e) => setAnnouncementBar(resolved.announcementBar?.enabled ?? false, e.target.value)}
          />
        </fieldset>

        <fieldset>
          <legend>WhatsApp button</legend>
          <label>
            <input
              type="checkbox"
              checked={resolved.whatsapp?.enabled ?? false}
              onChange={(e) => setWhatsapp(e.target.checked, resolved.whatsapp?.phoneNumber ?? "")}
            />
            Enabled
          </label>
          <input
            type="text"
            placeholder="+92300..."
            value={resolved.whatsapp?.phoneNumber ?? ""}
            onChange={(e) => setWhatsapp(resolved.whatsapp?.enabled ?? false, e.target.value)}
          />
        </fieldset>

        <fieldset>
          <legend>FAQ</legend>
          {resolved.faqItems.map((item, index) => (
            <div key={index} style={{ marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Question"
                value={item.question}
                onChange={(e) => updateFaqItem(index, "question", e.target.value)}
              />
              <input
                type="text"
                placeholder="Answer"
                value={item.answer}
                onChange={(e) => updateFaqItem(index, "answer", e.target.value)}
              />
              <button type="button" onClick={() => removeFaqItem(index)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addFaqItem}>
            Add question
          </button>
        </fieldset>

        <button type="button" onClick={onSave}>
          Save
        </button>
        {status && <p>{status}</p>}
      </div>

      <div style={{ border: "1px solid #e5e7eb" }}>
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
    </main>
  );
}
