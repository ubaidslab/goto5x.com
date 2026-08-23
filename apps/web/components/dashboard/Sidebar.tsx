"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { planTierSubtitle } from "@/lib/plan-tier-copy";
import { NAV_GROUP_LABELS, NavGroup, navItems } from "./nav-items";

/**
 * Typographic wordmark - "UZEYN" is the official platform name (no logo
 * design work per CLAUDE.md's Design Direction; this stays a considered
 * type treatment, not a mark/icon). Nothing else in this codebase should
 * hard-code the name outside this component and the brand-asset/content-
 * page system (SRS FR-12.1/FR-12.3) - a future rebrand is a data change.
 */
function Wordmark() {
  return (
    <div className="px-2">
      <span className="font-display text-h4 font-bold tracking-tight text-ink">UZEYN</span>
    </div>
  );
}

interface StoreSummary {
  id: string;
  name: string;
}

const GROUP_ORDER: NavGroup[] = ["main", "growth", "operations", "admin"];

function StoreSwitcher({ storeId, storeName, stores }: { storeId: string; storeName?: string; stores: StoreSummary[] }) {
  const router = useRouter();
  return stores.length > 1 ? (
    <div className="mt-5 px-2">
      <label htmlFor="store-switcher" className="sr-only">
        Switch store
      </label>
      <select
        id="store-switcher"
        value={storeId}
        onChange={(e) => router.push(`/stores/${e.target.value}`)}
        className="w-full rounded-md border border-border bg-canvas px-2 py-1.5 text-xs font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  ) : (
    storeName && <p className="mt-5 truncate px-2 text-xs font-medium uppercase tracking-wide text-ink-faint">{storeName}</p>
  );
}

function NavLinks({ storeId, showSuppliers, planName, onNavigate }: { storeId: string; showSuppliers: boolean; planName?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => !item.conditional || (item.label === "Suppliers" && showSuppliers));

  return (
    <nav className="mt-2 flex flex-1 flex-col gap-4">
      {GROUP_ORDER.map((group) => {
        const items = visibleItems.filter((item) => item.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className={group === "admin" ? "border-t border-border pt-4" : undefined}>
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{NAV_GROUP_LABELS[group]}</p>
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const href = item.href(storeId);
                const basePath = href.split("#")[0];
                const active = pathname === basePath || (basePath !== `/stores/${storeId}` && pathname?.startsWith(basePath));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-smooth-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active ? "bg-accent-subtle text-accent" : "text-ink-muted hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    {item.label}
                    {item.label === "Settings" && planName && (
                      <span className="ml-auto truncate text-xs font-normal text-ink-faint" title={planTierSubtitle(planName) ? `${planName} — ${planTierSubtitle(planName)}` : planName}>
                        {planName}
                        {planTierSubtitle(planName) && <span className="hidden lg:inline"> &middot; {planTierSubtitle(planName)}</span>}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  storeId,
  storeName,
  showSuppliers = false,
  stores = [],
  planName,
}: {
  storeId: string;
  storeName?: string;
  showSuppliers?: boolean;
  /** SRS §5.56/FR-56.3 - the seller's full store list, for the switcher below. Only rendered as a dropdown when there's more than one (a single-store seller sees the same plain label as before). */
  stores?: StoreSummary[];
  /** Shown as small text under the Settings link (Part B item 7 of the UI/UX mandate). */
  planName?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar - hidden md+, where the static sidebar takes over. */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] md:hidden" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-surface px-3 py-5 shadow-xl focus:outline-none md:hidden"
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <div className="flex items-center justify-between">
              <Wordmark />
              <DialogPrimitive.Close
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-faint hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
            <StoreSwitcher storeId={storeId} storeName={storeName} stores={stores} />
            <NavLinks storeId={storeId} showSuppliers={showSuppliers} planName={planName} onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Desktop static sidebar - hidden below md, where the drawer above takes over. */}
      <aside className="hidden h-screen w-64 flex-shrink-0 flex-col overflow-y-auto bg-surface px-3 py-5 md:flex">
        <Wordmark />
        <StoreSwitcher storeId={storeId} storeName={storeName} stores={stores} />
        <NavLinks storeId={storeId} showSuppliers={showSuppliers} planName={planName} />
      </aside>
    </>
  );
}
