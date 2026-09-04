"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowLeft, Copy, GripVertical, Lock, Plus, Redo2, RotateCcw, Trash2, Undo2 } from "lucide-react";
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

/** FR-8.21 (Module 100, founder batch B18) - D-Studio Pack purchase-request shape, mirroring the API's own. */
interface DstudioPackRequest {
  id: string;
  amount: string;
  currency: string;
  status: "pending" | "verified" | "rejected";
  requestedAt: string;
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
  // FR-8.21 (Module 100, founder batch B18) - D-Studio Pack: a seller-
  // purchasable, time-boxed full-catalog unlock, orthogonal to the tier
  // ladder above. `packModalOpen` gates a lightweight fetch of the
  // seller's own request history so it isn't loaded on every page visit,
  // only when they actually open the panel.
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [packRequests, setPackRequests] = useState<DstudioPackRequest[] | null>(null);
  const [packInstructions, setPackInstructions] = useState<string | null>(null);
  const [packSubmitting, setPackSubmitting] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  // D-Studio close-out (founder-requested undo/redo + autosave + version
  // safety) - "idle" here specifically means "edited, autosave pending" (see
  // the autosave effect below), not "nothing has happened yet"; the
  // workspace starts in "saved" the moment initial data loads, since at
  // that point local state genuinely matches what's live on the server.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "offline" | "error">("saved");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  // Editor-state history for undo/redo - capped at 20 entries per the
  // founder's "last ~20 actions" spec. Deliberately snapshots the whole
  // {themeId, settings} pair (not settings alone) so switching templates is
  // itself undoable. customCode is excluded - Custom CSS has its own
  // separate manual "Save code" flow, untouched by section/style edits.
  type EditorSnapshot = { themeId: string; settings: ThemeSettings };
  const MAX_HISTORY = 20;
  const [past, setPast] = useState<EditorSnapshot[]>([]);
  const [future, setFuture] = useState<EditorSnapshot[]>([]);
  // The settings/themeId this store's storefront was actually rendering
  // when this D-Studio session was opened - captured once, never mutated
  // by edits/undo/redo. "Restore last published version" reverts to this.
  // This is a session-local safety net, NOT a real version-history system
  // (that stays a documented D-Studio v2 item) - there is no draft/
  // published distinction in the backend today, so this is the only
  // available "known-good" baseline to fall back to.
  const publishedSnapshotRef = useRef<EditorSnapshot | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    api
      .get<{ id: string; name: string; slug: string; accessMode: PublicStore["accessMode"] }>(`/stores/${params.storeId}`)
      .then(setStore)
      .catch(() => {});
    api.get<Theme[]>("/themes").then(setThemes).catch(() => {});
    api
      .get<{ themeId: string; settings: ThemeSettings; customCode: string | null; codedModeEnabled: boolean; effectiveTierOrder: number }>(
        `/stores/${params.storeId}/theme-settings`,
      )
      .then((ts) => {
        const loadedSettings = ts.settings ?? {};
        setThemeId(ts.themeId);
        setSettings(loadedSettings);
        setCustomCode(ts.customCode ?? "");
        setCodedModeEnabled(ts.codedModeEnabled);
        // D-Studio close-out - effectiveTierOrder already folds in any live
        // admin-granted override (Settings Registry `dstudio.tier_override_
        // order`), so the UI reflects exactly what the server will enforce -
        // no separate /sellers/me/subscription fetch needed anymore.
        setSellerTierOrder(ts.effectiveTierOrder);
        // Undo/redo + version safety - this is the exact object reference
        // the autosave effect below compares against to tell "just loaded"
        // apart from "actually edited," and it's the baseline "restore last
        // published version" reverts to.
        publishedSnapshotRef.current = { themeId: ts.themeId, settings: loadedSettings };
      })
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
            // SRS §5.69 (Module 94) - not fetched by this preview's inline
            // type above; this panel doesn't render product details either.
            customAttributes: [],
          })),
        ),
      )
      .catch(() => {});
  }, [params.storeId]);

  useEffect(() => setOpenAnimSlot(null), [selected]);

  // Autosave (founder-requested "what makes the tool trustworthy for real
  // work") - debounced 1.5s after the last change so a burst of edits (drag
  // reorder, rapid variant switching) doesn't fire a save per keystroke.
  // Skips scheduling when settings/themeId still reference-equal the just-
  // loaded snapshot (nothing to save yet, or restoreLastPublished() already
  // persisted this exact state directly) - not a "skip the first render"
  // hack, which would misfire once the initial fetch's setState lands.
  useEffect(() => {
    const snap = publishedSnapshotRef.current;
    if (!snap || (settings === snap.settings && themeId === snap.themeId)) return;
    setSaveState("idle");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      persist(themeId, settings);
    }, 1500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, themeId]);

  // Undo/redo keyboard shortcuts - Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (or
  // Ctrl+Y) to redo. Skipped while typing in the Custom CSS textarea so a
  // seller's own text-editing undo (native textarea behavior) isn't hijacked.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future, themeId, settings]);

  const themeName = themes.find((t) => t.id === themeId)?.name ?? "Editorial";
  const resolved = useMemo(() => resolveThemeSettings(themeName, settings), [themeName, settings]);
  const sectionComponents = useMemo(() => getTemplateSections(themeName), [themeName]);
  const tierOrder = sellerTierOrder ?? 0;

  // Undo/redo - snapshots the state BEFORE a change is applied. Called once
  // per discrete edit (see updateSections below, applyTemplate, and the
  // color-picker/Custom-CSS onFocus handlers for continuous inputs, so a
  // whole drag/typing burst counts as a single undo step, not one per
  // keystroke).
  function pushHistory() {
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), { themeId, settings }]);
    setFuture([]);
  }

  function undo() {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [{ themeId, settings }, ...f].slice(0, MAX_HISTORY));
      setThemeId(prev.themeId);
      setSettings(prev.settings);
      return p.slice(0, -1);
    });
  }

  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, { themeId, settings }].slice(-MAX_HISTORY));
      setThemeId(next.themeId);
      setSettings(next.settings);
      return f.slice(1);
    });
  }

  function updateSections(next: ThemeSection[]) {
    pushHistory();
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
    // FR-8.21 (Module 100, founder batch B18) - a locked item at RISE's
    // ceiling or below can also be unlocked by the Pack (an orthogonal,
    // temporary alternative to upgrading the whole plan), so the toast
    // offers both paths. A FLY-exclusive item (requiredTier 3) isn't
    // helped by the Pack (it deliberately grants RISE, not FLY) - plain
    // upgrade copy only, same as before this FR.
    if (requiredTier <= 2) {
      toast({
        tone: "default",
        title: `${name} requires ${tierName(requiredTier)}`,
        description: `Upgrade to ${tierName(requiredTier)} or above, or get the D-Studio Pack for temporary full-catalog access.`,
        action: (
          <button onClick={() => setPackModalOpen(true)} className="text-xs font-semibold underline">
            Get Pack
          </button>
        ),
      });
    } else {
      toast({ tone: "default", title: `${name} requires ${tierName(requiredTier)}`, description: `Upgrade to ${tierName(requiredTier)} or above to use it.` });
    }
  }

  function loadPackRequests() {
    api
      .get<DstudioPackRequest[]>("/sellers/me/dstudio-pack-purchases")
      .then(setPackRequests)
      .catch(() => setPackRequests([]));
  }

  // Loads on every open regardless of entry point (toolbar button, or the
  // toast action on a locked item) - a single source of truth instead of
  // duplicating this call at each place that can set packModalOpen(true).
  useEffect(() => {
    if (packModalOpen) loadPackRequests();
  }, [packModalOpen]);

  async function requestPack() {
    setPackSubmitting(true);
    setPackError(null);
    try {
      const res = await api.post<{ request: DstudioPackRequest; instructions: string; autoVerified: boolean }>("/sellers/me/dstudio-pack-purchases");
      setPackInstructions(res.instructions);
      loadPackRequests();
      if (res.autoVerified) {
        // The grant is seller-scoped and folded into effectiveTierOrder on
        // the next theme-settings fetch - a full reload is the simplest way
        // to reflect it immediately without duplicating that resolution
        // logic client-side.
        toast({ tone: "success", title: "D-Studio Pack activated", description: "Reloading to reflect your new access…" });
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch {
      setPackError("Couldn't submit that purchase request. Please try again.");
    } finally {
      setPackSubmitting(false);
    }
  }

  function applyTemplate(newThemeId: string) {
    pushHistory();
    setThemeId(newThemeId);
    setTemplatesOpen(false);
  }

  // Takes explicit values rather than reading themeId/settings from closure,
  // since React state updates are async - restoreLastPublished() below needs
  // to persist the just-restored snapshot in the same call, before a
  // re-render would make the closure's themeId/settings reflect it.
  async function persist(themeIdToSave: string, settingsToSave: ThemeSettings) {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      await api.patch(`/stores/${params.storeId}/theme-settings`, { themeId: themeIdToSave, settings: settingsToSave });
      setSaveState("saved");
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveState("error");
        setErrorMsg(err.message);
      } else {
        // fetch() itself throws (TypeError, not ApiError) for a genuine
        // network-level failure - offline, DNS, server unreachable - as
        // opposed to a real HTTP 4xx/5xx the server returned.
        setSaveState("offline");
        setErrorMsg("Connection lost - not saved");
      }
    }
  }

  async function onSave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await persist(themeId, settings);
  }

  // Undo/redo + version safety (founder-requested) - the one recovery
  // action guaranteed to work even if the seller doesn't remember what they
  // changed: revert to exactly what was live when this D-Studio session
  // was opened, and persist that reversion immediately (autosave may have
  // already written a mistake to the server earlier in this same session).
  async function restoreLastPublished() {
    const snapshot = publishedSnapshotRef.current;
    if (!snapshot) return;
    pushHistory();
    setThemeId(snapshot.themeId);
    setSettings(snapshot.settings);
    setRestoreConfirmOpen(false);
    await persist(snapshot.themeId, snapshot.settings);
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
    chatEnabled: false,
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
        {tierOrder < 2 && (
          <button
            onClick={() => setPackModalOpen(true)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{ background: CHROME.accentDim, color: CHROME.tierRise, border: `1px solid ${CHROME.tierRise}` }}
          >
            Get full access
          </button>
        )}
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
        <button
          onClick={undo}
          disabled={past.length === 0}
          title="Undo (Ctrl/Cmd+Z)"
          className="rounded p-1.5"
          style={{ color: past.length === 0 ? CHROME.inkFaint : CHROME.inkMuted, opacity: past.length === 0 ? 0.4 : 1 }}
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={redo}
          disabled={future.length === 0}
          title="Redo (Ctrl/Cmd+Shift+Z)"
          className="rounded p-1.5"
          style={{ color: future.length === 0 ? CHROME.inkFaint : CHROME.inkMuted, opacity: future.length === 0 ? 0.4 : 1 }}
        >
          <Redo2 size={14} />
        </button>
        <button onClick={() => setRestoreConfirmOpen(true)} title="Restore the version live when this session opened" className="rounded p-1.5" style={{ color: CHROME.inkMuted }}>
          <RotateCcw size={14} />
        </button>
        <div className="mx-1 h-4 w-px" style={{ background: CHROME.border }} />
        <span
          className="text-[11px]"
          style={{ color: saveState === "error" || saveState === "offline" ? "#ff6b6b" : saveState === "idle" ? CHROME.tierRise : CHROME.inkFaint }}
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveState === "offline"
                ? "Connection lost — not saved"
                : saveState === "error"
                  ? (errorMsg ?? "Couldn't save")
                  : "Unsaved changes…"}
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
                      onFocus={pushHistory}
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

      {/* Restore-last-published confirm modal - version safety floor
          (founder-requested); a session-local "revert to what was live when
          I opened D-Studio" snapshot, not real version history (v2 item). */}
      {restoreConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(10,10,14,0.7)" }} onClick={() => setRestoreConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-xl p-5" style={{ background: CHROME.surface, border: `1px solid ${CHROME.border}` }} onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-sm font-semibold">Restore last published version?</h2>
            <p className="mb-4 text-xs" style={{ color: CHROME.inkMuted }}>
              Reverts to exactly what was live on your storefront when you opened D-Studio, discarding every change made in
              this session (including any already autosaved). This can be undone with Undo right after.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRestoreConfirmOpen(false)} className="rounded-md px-3 py-1.5 text-xs" style={{ color: CHROME.inkMuted }}>
                Cancel
              </button>
              <button onClick={restoreLastPublished} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: "#ff6b6b", color: "#1a0d0d" }}>
                Restore
              </button>
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

      {/* D-Studio Pack modal - FR-8.21 (Module 100, founder batch B18) */}
      {packModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-10" style={{ background: "rgba(10,10,14,0.7)" }} onClick={() => setPackModalOpen(false)}>
          <div className="w-full max-w-md rounded-xl" style={{ background: CHROME.surface, border: `1px solid ${CHROME.border}` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${CHROME.border}` }}>
              <h2 className="text-base font-semibold">D-Studio Pack</h2>
              <button onClick={() => setPackModalOpen(false)} style={{ color: CHROME.inkFaint }}>
                ✕
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-xs" style={{ color: CHROME.inkMuted }}>
                Rs. 1,499 for 3 months of the full 22-section/14-preset catalog - the same content RISE and FLY sellers already get, on any
                plan. No plan change, no lock-in; access reverts to your real plan automatically when it expires.
              </p>

              {packError && (
                <p className="rounded-md px-3 py-2 text-xs" style={{ background: "rgba(255,107,107,0.12)", color: "#ff6b6b" }}>
                  {packError}
                </p>
              )}

              {packInstructions && (
                <div className="rounded-md p-3 text-xs" style={{ background: CHROME.surfaceRaised, color: CHROME.inkMuted, whiteSpace: "pre-wrap" }}>
                  {packInstructions}
                </div>
              )}

              {packRequests === null ? (
                <p className="text-xs" style={{ color: CHROME.inkFaint }}>
                  Loading…
                </p>
              ) : (
                <>
                  {packRequests.some((r) => r.status === "pending") ? (
                    <p className="rounded-md px-3 py-2 text-xs" style={{ background: CHROME.accentDim, color: CHROME.tierRise }}>
                      You have a pending Pack purchase awaiting admin verification.
                    </p>
                  ) : (
                    <button
                      onClick={requestPack}
                      disabled={packSubmitting}
                      className="w-full rounded-md py-2 text-xs font-semibold"
                      style={{ background: CHROME.accent, color: "#0d1526", opacity: packSubmitting ? 0.6 : 1 }}
                    >
                      {packSubmitting ? "Submitting…" : "Request D-Studio Pack"}
                    </button>
                  )}

                  {packRequests.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: CHROME.inkFaint, fontFamily: "monospace" }}>
                        Your requests
                      </p>
                      {packRequests.map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-[11px]" style={{ color: CHROME.inkMuted }}>
                          <span>{new Date(r.requestedAt).toLocaleDateString()}</span>
                          <span
                            className="rounded-full px-2 py-0.5 capitalize"
                            style={{
                              background: r.status === "verified" ? "rgba(85,199,147,0.15)" : r.status === "rejected" ? "rgba(255,107,107,0.12)" : CHROME.accentDim,
                              color: r.status === "verified" ? CHROME.good : r.status === "rejected" ? "#ff6b6b" : CHROME.tierRise,
                            }}
                          >
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
