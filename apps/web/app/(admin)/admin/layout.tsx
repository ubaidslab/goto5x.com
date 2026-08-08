"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-api";

interface NotificationItem {
  label: string;
  count: number;
  href: string;
}
interface Notifications {
  totalCount: number;
  items: NotificationItem[];
}

/**
 * Module 25 (Admin Completion) - the shared nav this whole admin section
 * never had (§14 gap: "no admin can reach a queue without memorizing its
 * URL"). Bare, functional list of links - no design pass, matching every
 * other admin page's own stated discipline. The login page renders without
 * the nav (nothing to navigate to before authenticating).
 */
const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/admin", label: "Home" },
  { href: "/admin/search", label: "Search" },
  { href: "/admin/sellers", label: "Sellers" },
  { href: "/admin/invoices", label: "Wallet top-ups" },
  { href: "/admin/commission-invoices", label: "Commission invoices" },
  { href: "/admin/returns", label: "Returns & Refunds" },
  { href: "/admin/verification", label: "Verified Store" },
  { href: "/admin/moderation", label: "Moderation queue" },
  { href: "/admin/trust-safety", label: "Trust & Safety" },
  { href: "/admin/growth-programs/applications", label: "Growth: applications" },
  { href: "/admin/growth-programs/content-submissions", label: "Growth: content" },
  { href: "/admin/growth-programs/withdrawals", label: "Growth: withdrawals" },
  { href: "/admin/careers", label: "Careers" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/supplier-adapters", label: "Supplier adapters" },
  { href: "/admin/settings", label: "Settings Registry" },
  { href: "/admin/audit-log", label: "Audit log" },
  { href: "/admin/status", label: "System status" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/external-api-clients", label: "External API clients" },
  { href: "/admin/content-pages", label: "Content pages" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/email", label: "Email" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notifications | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    adminApi.get<Notifications>("/admin/notifications").then(setNotifications).catch(() => {});
  }, [pathname]);

  if (pathname === "/admin/login") return <>{children}</>;

  async function markSeen() {
    await adminApi.post("/admin/notifications/mark-seen");
    setNotifications((n) => (n ? { ...n, totalCount: 0, items: [] } : n));
    setOpen(false);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 220, borderRight: "1px solid #ccc", padding: 12, flexShrink: 0 }}>
        <p style={{ fontWeight: "bold", marginBottom: 8 }}>Admin</p>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <button onClick={() => setOpen((o) => !o)}>
            Notifications{notifications && notifications.totalCount > 0 ? ` (${notifications.totalCount})` : ""}
          </button>
          {open && (
            <div style={{ border: "1px solid #ccc", padding: 8, marginTop: 4, background: "white", position: "absolute", zIndex: 1, width: 260 }}>
              {!notifications || notifications.items.length === 0 ? (
                <p>Nothing new since you last checked.</p>
              ) : (
                <>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {notifications.items.map((item) => (
                      <li key={item.href} style={{ marginBottom: 6 }}>
                        <Link href={item.href} onClick={() => setOpen(false)}>
                          {item.label}: {item.count}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <button onClick={markSeen}>Mark all as seen</button>
                </>
              )}
            </div>
          )}
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {NAV_LINKS.map((link) => (
            <li key={link.href} style={{ marginBottom: 6 }}>
              <Link href={link.href} style={{ fontWeight: pathname === link.href ? "bold" : "normal" }}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div style={{ flex: 1, padding: 16 }}>{children}</div>
    </div>
  );
}
