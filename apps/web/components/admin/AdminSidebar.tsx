"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Bell, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ADMIN_NAV_GROUP_LABELS, AdminNavGroup, adminNavItems } from "./nav-items";

const GROUP_ORDER: AdminNavGroup[] = ["overview", "commerce", "trust", "growth", "platform", "content"];

function Wordmark() {
  return (
    <div className="px-2">
      <span className="font-display text-h4 font-bold tracking-tight text-ink">UZEYN</span>
      <span className="ml-1.5 align-middle text-xs font-semibold uppercase tracking-wide text-ink-faint">Admin</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="mt-2 flex flex-1 flex-col gap-4">
      {GROUP_ORDER.map((group) => {
        const items = adminNavItems.filter((item) => item.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{ADMIN_NAV_GROUP_LABELS[group]}</p>
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-smooth-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      active ? "bg-accent-subtle text-accent" : "text-ink-muted hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    {item.label}
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

interface NotificationItem {
  label: string;
  count: number;
  href: string;
}
interface Notifications {
  totalCount: number;
  items: NotificationItem[];
}

/** Restyled with the same tokens/notification bell every internal admin tool has - unread count, dropdown list, mark-all-seen. Same data/endpoint as before, just no longer raw unstyled HTML. */
function NotificationsBell({ notifications, onMarkSeen }: { notifications: Notifications | null; onMarkSeen: () => void }) {
  const [open, setOpen] = useState(false);
  const count = notifications?.totalCount ?? 0;

  return (
    <div className="relative px-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        className="relative flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-sm font-medium text-ink-muted transition-smooth-fast hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Bell className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
        Notifications
        {count > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-2 top-full z-20 mt-1 w-72 rounded-md border border-border bg-surface p-2 shadow-lg">
          {!notifications || notifications.items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-muted">Nothing new since you last checked.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-0.5">
                {notifications.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-ink transition-smooth-fast hover:bg-canvas"
                    >
                      <span>{item.label}</span>
                      <span className="font-semibold tabular-nums text-ink-muted">{item.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onMarkSeen}
                className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-accent hover:bg-canvas"
              >
                Mark all as seen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminSidebar({ notifications, onMarkSeen }: { notifications: Notifications | null; onMarkSeen: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
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
            <DialogPrimitive.Title className="sr-only">Admin navigation</DialogPrimitive.Title>
            <div className="flex items-center justify-between">
              <Wordmark />
              <DialogPrimitive.Close
                aria-label="Close navigation"
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-faint hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
            <div className="mt-5">
              <NotificationsBell notifications={notifications} onMarkSeen={onMarkSeen} />
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <aside className="hidden h-screen w-64 flex-shrink-0 flex-col overflow-y-auto bg-surface px-3 py-5 md:flex">
        <Wordmark />
        <div className="mt-5">
          <NotificationsBell notifications={notifications} onMarkSeen={onMarkSeen} />
        </div>
        <NavLinks />
      </aside>
    </>
  );
}
