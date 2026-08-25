"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Copy, GripVertical, Lock, Plus, Redo2, Trash2 } from "lucide-react";
import {
  ANIMATION_CATALOG,
  ALL_ANIMATION_IDS,
  SECTION_CATALOG,
  maxAllowedVariantIndex,
  tierName,
} from "@/lib/section-catalog";
import { AnimationId, ElementSlot, resolveThemeSettings, SectionId, ThemeSection, ThemeSettings } from "@/lib/theme-presets";
import { PublicProduct, PublicStore } from "@/lib/storefront-api";
import { getTemplateSections } from "@/app/storefront/templates/registry";
import { ApiError, api } from "@/lib/dashboard-api";
import { toast } from "@/lib/use-toast";

/**
 * D-Studio v1 - the flagship, fullscreen, Figma/Webflow-style design
 * workspace (founder directive: "must be a real standalone... NOT embedded
 * inside the normal dashboard chrome"). Deliberately lives OUTSIDE the
 * (dashboard) route group's layout tree - app/stores/[storeId]/d-studio/,
 * not app/(dashboard)/stores/[storeId]/... - so no Sidebar/topbar renders
 * at all; only the root layout's html/body/fonts/Toaster apply. Auth is
 * the same client-side accessToken-in-localStorage pattern every other
 * dashboard page already uses (lib/dashboard-api.ts) - no new auth surface.
 *
 * A deliberately distinct dark "creative-tool chrome" (not the dashboard's
 * light monochrome tokens) - same reasoning Figma/Webflow/Photoshop use a
 * dark workspace so canvas colors read clearly; the interactive accent
 * hue is kept close to the rest of the product's own accent family so it
 * doesn't feel like a different product.
 */

const CHROME = {
  bg: "#131318",
  surface: "#1b1b22",
  surfaceRaised: "#232330",
  surfaceHover: "#292937",
  border: "#33333f",
  borderStrong: "#454455",
  ink: "#f3f2ef",
  inkMuted: "#a6a4b3",
  inkFaint: "#6d6b7c",
  accent: "#5b8dff",
  accentDim: "rgba(91,141,255,0.14)",
  tierRise: "#d6a94a",
  good: "#55c793",
};

interface Theme {
  id: string;
  name: string;
  tier: "free" | "premium" | "marketplace";
  entitled: boolean;
}

const CATEGORIES = ["Marketing", "Catalog", "Content", "Social proof", "Structural"] as const;

function SortableRow({
  section,
  index,
  selected,
  onSelect,
  onToggleVisible,
  onDuplicate,
  onRemove,
}: {
  section: ThemeSection;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `${section.id}-${index}` });
  const catalog = SECTION_CATALOG[section.id];
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: selected ? CHROME.accentDim : CHROME.surfaceRaised,
        border: `1px solid ${selected ? CHROME.accent : "transparent"}`,
      }}
      className="mb-1 flex items-center gap-2 rounded-md px-2 py-2"
      onClick={onSelect}
    >
      <button {...attributes} {...listeners} className="cursor-grab touch-none" style={{ color: CHROME.inkFaint }} aria-label="Drag to reorder">
        <GripVertical size={14} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium" style={{ color: section.visible ? CHROME.ink : CHROME.inkFaint }}>
          {catalog.name}
        </p>
        <p className="truncate text-[10px]" style={{ color: CHROME.inkFaint, fontFamily: "monospace" }}>
          {catalog.variants[section.variant ?? 0] ?? catalog.variants[0]}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
          }}
          className="rounded px-1.5 py-0.5 text-[10px]"
          style={{ color: section.visible ? CHROME.good : CHROME.inkFaint }}
          title={section.visible ? "Visible - click to hide" : "Hidden - click to show"}
        >
          {section.visible ? "On" : "Off"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="rounded p-1"
          style={{ color: CHROME.inkFaint }}
          title="Duplicate"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded p-1"
          style={{ color: CHROME.inkFaint }}
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function DStudioPage({ params }: { params: { storeId: string } }) {
  const [store, setStore] = useState<{ id: string; name: string; slug: string; accessMode: PublicStore["accessMode"] } | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themeId, setThemeId] = useState("");
  const [settings, setSettings] = useState<ThemeSettings>({});
  const [customCode, setCustomCode] = useState("");
  const [codedModeEnabled, setCodedModeEnabled] = useState<boolean | null>(null);
  const [sellerTierOrder, setSellerTierOrder] = useState<number | null>(null);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [selected, setSelected] = useState(0);
  const [openAnimSlot, setOpenAnimSlot] = useState<ElementSlot | null>(null);
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [leftTab, setLeftTab] = useState<"sections" | "style" | "code">("sections");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [galleryCat, setGalleryCat] = useState<(typeof CATEGORIES)[number] | "All">("All");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    api
      .get<{ id: string; name: string; slug: string; accessMode: PublicStore["accessMode"] }>(`/stores/${params.storeId}`)
      .then(setStore)
      .catch(() => {});
    api.get<Theme[]>("/themes").then(setThemes).catch(() => {});
    api
      .get<{ themeId: string; settings: ThemeSettings; customCode: string | null; codedModeEnabled: boolean }>(`/stores/${params.storeId}/theme-settings`)
      .then((ts) => {
        setThemeId(ts.themeId);
        setSettings(ts.settings ?? {});
        setCustomCode(ts.customCode ?? "");
        setCodedModeEnabled(ts.codedModeEnabled);
      })
      .catch(() => {});
    api
      .get<{ plan: { tierOrder: number } }>("/sellers/me/subscription")
      .then((sub) => setSellerTierOrder(sub.plan.tierOrder))
      .catch(() => setSellerTierOrder(0));
    api
      .get<{ items: Array<{ id: string; title: string; description: string | null; averageRating: string; reviewCount: number; variants?: unknown[]; seoTitle?: string; seoDescription?: string | null }> }>(
        `/stores/${params.storeId}/products?limit=100`,
      )
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
            canonicalUrl: null,
            robotsIndex: true,
            robotsFollow: true,
            ogImageUrl: null,
            ogTitle: p.seoTitle ?? p.title,
            ogDescription: p.seoDescription ?? null,
            structuredDataEnabled: true,
            sitemapIncluded: true,
            slug: null,
            supplierShipping: null,
          })),
        ),
      )
      .catch(() => {});
  }, [params.storeId]);

  useEffect(() => setOpenAnimSlot(null), [selected]);

  const themeName = themes.find((t) => t.id === themeId)?.name ?? "Editorial";
  const resolved = useMemo(() => resolveThemeSettings(themeName, settings), [themeName, settings]);
  const sectionComponents = useMemo(() => getTemplateSections(themeName), [themeName]);
  const tierOrder = sellerTierOrder ?? 0;

  function updateSections(next: ThemeSection[]) {
    setSettings((s) => ({ ...s, sections: next }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = resolved.sections.map((s, i) => `${s.id}-${i}`);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    updateSections(arrayMove(resolved.sections, oldIndex, newIndex));
    setSelected(newIndex);
  }

  function toggleVisible(index: number) {
    const next = resolved.sections.slice();
    next[index] = { ...next[index], visible: !next[index].visible };
    updateSections(next);
  }

  function duplicateSection(index: number) {
    const next = resolved.sections.slice();
    next.splice(index + 1, 0, { ...next[index] });
    updateSections(next);
    setSelected(index + 1);
  }

  function removeSection(index: number) {
    const next = resolved.sections.filter((_, i) => i !== index);
    updateSections(next);
    setSelected((s) => Math.max(0, Math.min(s, next.length - 1)));
  }

  function addSection(id: SectionId) {
    const catalog = SECTION_CATALOG[id];
    if (catalog.tierFloor > tierOrder) return;
    updateSections([...resolved.sections, { id, visible: true, variant: 0, elementAnimations: {} }]);
    setSelected(resolved.sections.length);
    setLibraryOpen(false);
  }

  function setVariant(index: number, variant: number) {
    const next = resolved.sections.slice();
    next[index] = { ...next[index], variant };
    updateSections(next);
  }

  function setElementAnimation(index: number, slot: ElementSlot, animationId: AnimationId) {
    const next = resolved.sections.slice();
    next[index] = { ...next[index], elementAnimations: { ...next[index].elementAnimations, [slot]: animationId } };
    updateSections(next);
  }

  // D-Studio close-out - the locked-not-disabled pattern: a gated item
  // always shows its full label/name and stays clickable, never dims or
  // disables. Clicking one surfaces exactly what tier it needs instead of
  // silently doing nothing (the founder-flagged failure mode of a plain
  // `disabled` attribute).
  function notifyLocked(name: string, requiredTier: number) {
    toast({ tone: "default", title: `${name} requires ${tierName(requiredTier)}`, description: `Upgrade to ${tierName(requiredTier)} or above to use it.` });
  }

  function applyTemplate(newThemeId: string) {
    setThemeId(newThemeId);
    setTemplatesOpen(false);
  }

  async function onSave() {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      await api.patch(`/stores/${params.storeId}/theme-settings`, { themeId, settings });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      setErrorMsg(err instanceof ApiError ? err.message : "Couldn't save.");
    }
  }

  async function saveCustomCode() {
    try {
      await api.patch(`/stores/${params.storeId}/theme-settings`, { customCode });
      toast({ tone: "success", title: "Custom code saved" });
    } catch (err) {
      toast({ tone: "danger", title: err instanceof ApiError ? err.message : "Couldn't save your custom code." });
    }
  }

  if (!store || sellerTierOrder === null || !themes.length) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: CHROME.bg, color: CHROME.inkMuted }}>
        <p className="text-sm">Loading D-Studio…</p>
      </div>
    );
  }

  const selectedSection = resolved.sections[selected];
  const selectedCatalog = selectedSection ? SECTION_CATALOG[selectedSection.id] : null;
  const previewStore: PublicStore = {
    id: store.id,
    name: store.name,
    slug: store.slug,
    currency: "PKR",
    accessMode: store.accessMode,
    canonicalHostname: `${store.slug}.uzeyn.com`,
    seoTitle: store.name,
    seoDescription: null,
    logoUrl: resolved.logoUrl ?? null,
    verified: false,
    poweredByVisible: true,
    theme: { name: themeName, settings: settings as Record<string, unknown> },
    seoRobotsIndexDefault: true,
    seoRobotsFollowDefault: true,
    seoStructuredDataDefault: true,
    seoSitemapIncludedDefault: true,
    customHeadTags: null,
  };

  const deviceMaxWidth = device === "mobile" ? 420 : device === "tablet" ? 620 : 960;

  function renderSection(section: ThemeSection, index: number) {
    const s = sectionComponents;
    const variant = section.variant;
    const elementAnimations = section.elementAnimations;
    const key = `${section.id}-${index}`;
    switch (section.id) {
      case "hero":
        return <s.Hero key={key} store={previewStore} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "featured_products":
        return <s.FeaturedProducts key={key} products={products} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "about":
        return <s.About key={key} store={previewStore} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "newsletter":
        return <s.Newsletter key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "faq":
        return <s.Faq key={key} theme={resolved} items={resolved.faqItems} variant={variant} elementAnimations={elementAnimations} />;
      case "testimonials":
        return <s.Testimonials key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "footer_contact":
        return <s.FooterContact key={key} theme={resolved} store={previewStore} variant={variant} elementAnimations={elementAnimations} />;
      case "spacer":
        return <s.Spacer key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "featured_collection":
        return <s.FeaturedCollection key={key} theme={resolved} collection={null} variant={variant} elementAnimations={elementAnimations} />;
      case "gallery":
        return <s.Gallery key={key} theme={resolved} images={[]} variant={variant} elementAnimations={elementAnimations} />;
      case "video_banner":
        return <s.VideoBanner key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "countdown":
        return <s.Countdown key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "stats_counter":
        return <s.StatsCounter key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "logo_cloud":
        return <s.LogoCloud key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "team":
        return <s.Team key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "before_after":
        return <s.BeforeAfter key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "map_location":
        return <s.MapLocation key={key} theme={resolved} store={previewStore} variant={variant} elementAnimations={elementAnimations} />;
      case "social_feed":
        return <s.SocialFeed key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "sticky_cta":
        return <s.StickyCta key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "shape_divider":
        return <s.ShapeDivider key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      case "comparison_table":
        return <s.ComparisonTable key={key} theme={resolved} products={products} variant={variant} elementAnimations={elementAnimations} />;
      case "blog_highlight":
        return <s.BlogHighlight key={key} theme={resolved} variant={variant} elementAnimations={elementAnimations} />;
      default:
        return null;
    }
  }

  const galleryList = Object.entries(SECTION_CATALOG).filter(([, c]) => galleryCat === "All" || c.category === galleryCat);

  return (
    <div className="flex h-screen flex-col" style={{ background: CHROME.bg, color: CHROME.ink, fontFamily: "var(--font-inter, sans-serif)" }}>
      {/* Top bar - slim, minimal, no dashboard chrome */}
      <div className="flex h-12 flex-shrink-0 items-center gap-3 px-4" style={{ borderBottom: `1px solid ${CHROME.border}`, background: CHROME.surface }}>
        <Link href={`/stores/${params.storeId}`} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs" style={{ color: CHROME.inkMuted }}>
          <ArrowLeft size={14} /> Exit
        </Link>
        <div className="mx-2 h-4 w-px" style={{ background: CHROME.border }} />
        <span className="text-xs font-medium">{store.name}</span>
        <div className="flex-1" />
        <div className="flex overflow-hidden rounded-full p-0.5" style={{ background: CHROME.surfaceRaised, border: `1px solid ${CHROME.border}` }}>
          {(["mobile", "tablet", "desktop"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className="rounded-full px-2.5 py-1 text-[10px] capitalize"
              style={{ background: device === d ? CHROME.surfaceHover : "transparent", color: device === d ? CHROME.ink : CHROME.inkFaint }}
            >
              {d}
            </button>
          ))}
        </div>
        <span className="text-[11px]" style={{ color: saveState === "error" ? "#ff6b6b" : CHROME.inkFaint }}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? errorMsg ?? "Couldn't save" : "Unsaved changes are local"}
        </span>
        <button
          onClick={onSave}
          disabled={saveState === "saving"}
          className="rounded-md px-3 py-1.5 text-xs font-semibold"
          style={{ background: CHROME.accent, color: "#0d1420" }}
        >
          Save
        </button>
      </div>

      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "260px 1fr 300px" }}>
        {/* Left rail */}
        <div className="flex min-h-0 flex-col" style={{ background: CHROME.surface, borderRight: `1px solid ${CHROME.border}` }}>
          <div className="flex flex-shrink-0" style={{ borderBottom: `1px solid ${CHROME.border}` }}>
            {(["sections", "style", "code"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setLeftTab(t)}
                className="flex-1 py-2.5 text-xs font-medium capitalize"
                style={{ color: leftTab === t ? CHROME.ink : CHROME.inkFaint, borderBottom: leftTab === t ? `2px solid ${CHROME.accent}` : "2px solid transparent" }}
              >
                {t === "code" ? "Custom CSS" : t}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {leftTab === "sections" && (
              <>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={resolved.sections.map((s, i) => `${s.id}-${i}`)} strategy={verticalListSortingStrategy}>
                    {resolved.sections.map((section, index) => (
                      <SortableRow
                        key={`${section.id}-${index}`}
                        section={section}
                        index={index}
                        selected={index === selected}
                        onSelect={() => setSelected(index)}
                        onToggleVisible={() => toggleVisible(index)}
                        onDuplicate={() => duplicateSection(index)}
                        onRemove={() => removeSection(index)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <button
                  onClick={() => setLibraryOpen(true)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-xs"
                  style={{ border: `1px dashed ${CHROME.borderStrong}`, color: CHROME.inkMuted }}
                >
                  <Plus size={13} /> Add section
                </button>
                <button
                  onClick={() => setTemplatesOpen(true)}
                  className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs"
                  style={{ color: CHROME.inkMuted }}
                >
                  <Redo2 size={13} /> Template gallery
                </button>
              </>
            )}
            {leftTab === "style" && (
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-wide" style={{ color: CHROME.inkFaint, fontFamily: "monospace" }}>
                  Colors
                </p>
                {(["primary", "background", "text"] as const).map((key) => (
                  <label key={key} className="flex items-center justify-between text-xs" style={{ color: CHROME.inkMuted }}>
                    <span className="capitalize">{key}</span>
                    <input
                      type="color"
                      value={resolved.colors[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, colors: { ...resolved.colors, [key]: e.target.value } }))}
                      className="h-6 w-10 cursor-pointer rounded border-none bg-transparent"
                    />
                  </label>
                ))}
                <p className="pt-2 text-[11px]" style={{ color: CHROME.inkFaint }}>
                  Typography and logo/media upload live on the classic{" "}
                  <Link href={`/stores/${params.storeId}/customizer`} className="underline">
                    Customizer page
                  </Link>{" "}
                  for now.
                </p>
              </div>
            )}
            {leftTab === "code" && (
              <div>
                {tierOrder < 2 ? (
                  <div className="rounded-md p-3 text-xs" style={{ background: CHROME.surfaceRaised, color: CHROME.inkMuted }}>
                    <Lock size={14} style={{ color: CHROME.tierRise }} className="mb-2" />
                    Custom CSS requires RISE or above.
                  </div>
                ) : (
                  <>
                    <div className="mb-2 rounded-md p-2 text-[10.5px] leading-relaxed" style={{ background: "rgba(214,169,74,0.12)", border: `1px solid ${CHROME.tierRise}55`, color: CHROME.inkMuted }}>
                      Saved here, but not yet rendered on your live storefront in this release - there
                      is no execution path for it yet. Use this as a staging area; nothing you write
                      here is visible to buyers today.
                    </div>
                    <p className="mb-2 text-[11px]" style={{ color: CHROME.inkFaint }}>
                      Scoped, presentation-only CSS. Never touches cart/checkout/account.
                    </p>
                    <textarea
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value)}
                      rows={12}
                      spellCheck={false}
                      className="w-full rounded-md p-2 font-mono text-[11px]"
                      style={{ background: "#0d0d11", border: `1px solid ${CHROME.border}`, color: "#b7c4ff" }}
                    />
                    <button onClick={saveCustomCode} className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: CHROME.surfaceRaised, border: `1px solid ${CHROME.borderStrong}`, color: CHROME.ink }}>
                      Save code
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex min-h-0 flex-col items-center overflow-y-auto p-5" style={{ background: "#0e0e12" }}>
          <div className="w-full overflow-hidden rounded-xl bg-white shadow-2xl" style={{ maxWidth: deviceMaxWidth }}>
            <div className="flex h-6 items-center gap-1.5 bg-neutral-200 px-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
            </div>
            <div className="h-[640px] overflow-y-auto text-[#17171c]">
              {resolved.sections.filter((s) => s.visible).length === 0 ? (
                <p className="p-10 text-center text-sm opacity-50">No visible sections yet - add one from the library.</p>
              ) : (
                resolved.sections.map((section, index) => (section.visible ? <div key={`${section.id}-${index}`}>{renderSection(section, index)}</div> : null))
              )}
            </div>
          </div>
        </div>

        {/* Right inspector */}
        <div className="flex min-h-0 flex-col overflow-y-auto p-3" style={{ background: CHROME.surface, borderLeft: `1px solid ${CHROME.border}` }}>
          {!selectedSection || !selectedCatalog ? (
            <p className="p-2 text-xs" style={{ color: CHROME.inkFaint }}>
              Select a section to edit its layout and animation.
            </p>
          ) : (
            <>
              <p className="mb-1 text-[10px] uppercase tracking-wide" style={{ color: CHROME.accent, fontFamily: "monospace" }}>
                {selectedCatalog.category} section
              </p>
              <h3 className="mb-4 text-sm font-semibold">{selectedCatalog.name}</h3>

              {selectedCatalog.variants.length > 1 && (
                <>
                  <p className="mb-2 text-[10px] uppercase tracking-wide" style={{ color: CHROME.inkFaint, fontFamily: "monospace" }}>
                    Layout variant
                  </p>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {selectedCatalog.variants.map((label, vi) => {
                      const requiredTier = vi <= selectedCatalog.maxVariantIndexByTier[0] ? 0 : vi <= selectedCatalog.maxVariantIndexByTier[1] ? 1 : 2;
                      const locked = vi > maxAllowedVariantIndex(selectedSection.id, tierOrder);
                      const activeVariant = (selectedSection.variant ?? 0) === vi;
                      return (
                        <button
                          key={label}
                          onClick={() => (locked ? notifyLocked(`${label}`, requiredTier) : setVariant(selected, vi))}
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono"
                          style={{
                            background: activeVariant ? CHROME.accent : CHROME.surfaceRaised,
                            color: activeVariant ? "#0d1420" : CHROME.inkMuted,
                            border: `1px solid ${CHROME.borderStrong}`,
                          }}
                          title={locked ? `Requires ${tierName(requiredTier)} - click for details` : undefined}
                        >
                          {locked && <Lock size={10} style={{ color: CHROME.tierRise }} />}
                          {label}
                        </button>
                      );
                    })}
                    {selectedCatalog.flyExclusiveVariant && (
                      <button
                        onClick={() => notifyLocked(selectedCatalog.flyExclusiveVariant!, 3)}
                        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono"
                        style={{ border: `1px solid ${CHROME.borderStrong}`, color: CHROME.inkMuted, background: CHROME.surfaceRaised }}
                      >
                        <Lock size={10} style={{ color: CHROME.tierRise }} />
                        {selectedCatalog.flyExclusiveVariant}
                      </button>
                    )}
                  </div>
                </>
              )}

              {selectedCatalog.elements.length > 0 && (
                <>
                  <p className="mb-2 text-[10px] uppercase tracking-wide" style={{ color: CHROME.inkFaint, fontFamily: "monospace" }}>
                    Per-element animation
                  </p>
                  {selectedCatalog.elements.map((slot) => {
                    const current = selectedSection.elementAnimations?.[slot] ?? "none";
                    const isOpen = openAnimSlot === slot;
                    return (
                      <div key={slot} className="relative mb-2 rounded-md p-2" style={{ background: CHROME.surfaceRaised, border: `1px solid ${CHROME.border}` }}>
                        <p className="mb-1 text-[11px] capitalize" style={{ color: CHROME.ink }}>
                          {slot}
                        </p>
                        <button
                          onClick={() => setOpenAnimSlot(isOpen ? null : slot)}
                          className="flex w-full items-center justify-between rounded p-1.5 text-left text-[11px] font-mono"
                          style={{ background: CHROME.bg, border: `1px solid ${CHROME.borderStrong}`, color: CHROME.ink }}
                        >
                          {ANIMATION_CATALOG[current as AnimationId].label}
                          <span style={{ color: CHROME.inkFaint }}>{isOpen ? "▲" : "▼"}</span>
                        </button>
                        {isOpen && (
                          <div
                            className="absolute left-2 right-2 z-20 mt-1 max-h-56 overflow-y-auto rounded-md"
                            style={{ background: CHROME.bg, border: `1px solid ${CHROME.borderStrong}`, boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}
                          >
                            {ALL_ANIMATION_IDS.map((id) => {
                              const locked = ANIMATION_CATALOG[id].tierFloor > tierOrder;
                              const active = id === current;
                              return (
                                <button
                                  key={id}
                                  onClick={() => {
                                    if (locked) {
                                      notifyLocked(ANIMATION_CATALOG[id].label, ANIMATION_CATALOG[id].tierFloor);
                                      return;
                                    }
                                    setElementAnimation(selected, slot, id);
                                    setOpenAnimSlot(null);
                                  }}
                                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[11px] font-mono"
                                  style={{ background: active ? CHROME.accentDim : "transparent", color: active ? CHROME.accent : CHROME.ink }}
                                >
                                  <span>{ANIMATION_CATALOG[id].label}</span>
                                  {locked && (
                                    <span className="flex items-center gap-1" style={{ color: CHROME.tierRise }}>
                                      <Lock size={9} /> {tierName(ANIMATION_CATALOG[id].tierFloor)}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Section library modal */}
      {libraryOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-10" style={{ background: "rgba(10,10,14,0.7)" }} onClick={() => setLibraryOpen(false)}>
          <div className="w-full max-w-4xl rounded-xl" style={{ background: CHROME.surface, border: `1px solid ${CHROME.border}` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${CHROME.border}` }}>
              <h2 className="text-base font-semibold">Section library</h2>
              <button onClick={() => setLibraryOpen(false)} style={{ color: CHROME.inkFaint }}>
                ✕
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-6 pt-3">
              {(["All", ...CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setGalleryCat(c)}
                  className="rounded-full px-2.5 py-1 text-[11px]"
                  style={{
                    background: galleryCat === c ? CHROME.accentDim : CHROME.surfaceRaised,
                    color: galleryCat === c ? CHROME.accent : CHROME.inkMuted,
                    border: `1px solid ${galleryCat === c ? CHROME.accent : CHROME.border}`,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="grid max-h-[60vh] grid-cols-4 gap-3 overflow-y-auto p-6">
              {galleryList.map(([id, catalog]) => {
                const locked = catalog.tierFloor > tierOrder;
                return (
                  <button
                    key={id}
                    onClick={() => (locked ? notifyLocked(catalog.name, catalog.tierFloor) : addSection(id as SectionId))}
                    className="rounded-lg p-3 text-left"
                    style={{ background: CHROME.surfaceRaised, border: `1px solid ${CHROME.border}` }}
                  >
                    <div className="relative mb-2 flex h-16 items-center justify-center rounded" style={{ background: CHROME.bg }}>
                      <div className="h-8 w-14 rounded" style={{ background: CHROME.borderStrong, opacity: locked ? 0.35 : 1 }} />
                      {locked && (
                        <div className="absolute inset-0 flex items-center justify-center rounded" style={{ background: "rgba(10,10,14,0.45)" }}>
                          <Lock size={18} style={{ color: CHROME.ink }} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-semibold">{catalog.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: CHROME.inkFaint, fontFamily: "monospace" }}>
                        {catalog.variants.length} layout{catalog.variants.length > 1 ? "s" : ""}
                      </span>
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: CHROME.accentDim, color: CHROME.accent }}>
                        {tierName(catalog.tierFloor)}
                      </span>
                    </div>
                    {locked && (
                      <p className="mt-1 text-[10px]" style={{ color: CHROME.tierRise }}>
                        Upgrade to {tierName(catalog.tierFloor)} to unlock →
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Template gallery modal */}
      {templatesOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-10" style={{ background: "rgba(10,10,14,0.7)" }} onClick={() => setTemplatesOpen(false)}>
          <div className="w-full max-w-3xl rounded-xl" style={{ background: CHROME.surface, border: `1px solid ${CHROME.border}` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${CHROME.border}` }}>
              <h2 className="text-base font-semibold">Template gallery</h2>
              <button onClick={() => setTemplatesOpen(false)} style={{ color: CHROME.inkFaint }}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 p-6">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    t.entitled
                      ? applyTemplate(t.id)
                      : toast({
                          tone: "default",
                          title: `${t.name} requires ${t.tier === "marketplace" ? "a purchased license" : "RISE or above"}`,
                          description: t.tier === "marketplace" ? "Available in the Template Store." : "Upgrade your plan to unlock this template.",
                        })
                  }
                  className="rounded-lg p-3 text-left"
                  style={{ background: CHROME.surfaceRaised, border: `1px solid ${t.id === themeId ? CHROME.accent : CHROME.border}` }}
                >
                  <div className="relative mb-2 h-20 rounded" style={{ background: CHROME.bg }}>
                    {!t.entitled && (
                      <div className="absolute inset-0 flex items-center justify-center rounded" style={{ background: "rgba(10,10,14,0.45)" }}>
                        <Lock size={18} style={{ color: CHROME.ink }} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold">{t.name}</p>
                  <p className="mt-1 text-[10px] uppercase" style={{ color: CHROME.inkFaint, fontFamily: "monospace" }}>
                    {t.tier}
                    {!t.entitled ? " · locked" : ""}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
