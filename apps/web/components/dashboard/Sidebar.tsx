"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navItems } from "./nav-items";

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

export function Sidebar({
  storeId,
  storeName,
  showSuppliers = false,
  stores = [],
}: {
  storeId: string;
  storeName?: string;
  showSuppliers?: boolean;
  /** SRS §5.56/FR-56.3 - the seller's full store list, for the switcher below. Only rendered as a dropdown when there's more than one (a single-store seller sees the same plain label as before). */
  stores?: StoreSummary[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleItems = navItems.filter((item) => !item.conditional || (item.label === "Suppliers" && showSuppliers));

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r border-border bg-surface px-3 py-5">
      <Wordmark />

      {stores.length > 1 ? (
        <div className="mt-5 px-2">
          <label htmlFor="store-switcher" className="sr-only">
            Switch store
          </label>
          <select
            id="store-switcher"
            value={storeId}
            onChange={(e) => router.push(`/stores/${e.target.value}`)}
            className="w-full rounded-md border border-border bg-canvas px-2 py-1.5 text-xs font-medium text-ink"
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
      )}

      <nav className="mt-2 flex flex-1 flex-col gap-0.5">
        {visibleItems.map((item) => {
          const href = item.href(storeId);
          const active = pathname === href || (href !== `/stores/${storeId}` && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-smooth-fast ${
                active ? "bg-accent-subtle text-accent" : "text-ink-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
