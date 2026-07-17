"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";

/** Placeholder wordmark - swap for the real logo once branding assets exist (founder review pending, see design-tokens note in app/globals.css). */
function Wordmark() {
  return (
    <div className="flex items-center gap-2 px-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-on-accent">
        5x
      </span>
      <span className="text-sm font-semibold tracking-tight text-ink">goto5x</span>
    </div>
  );
}

export function Sidebar({ storeId, storeName }: { storeId: string; storeName?: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r border-border bg-surface px-3 py-5">
      <Wordmark />

      {storeName && <p className="mt-5 truncate px-2 text-xs font-medium uppercase tracking-wide text-ink-faint">{storeName}</p>}

      <nav className="mt-2 flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => {
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
