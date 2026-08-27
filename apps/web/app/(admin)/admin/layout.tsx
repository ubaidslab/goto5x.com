"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ConfirmDialogProvider } from "@/components/admin/ConfirmDialogProvider";
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
 * Phase 6 (Admin Terminal re-skin) - same shared nav Module 25 (Admin
 * Completion) built, restyled onto this project's real design tokens
 * instead of raw inline styles. Every link, the notifications dropdown, and
 * ConfirmDialogProvider are all unchanged in behavior - this pass restyles
 * and groups, it does not remove or simplify any control surface (standing
 * founder directive). See components/admin/nav-items.ts for the full,
 * unchanged link list.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notifications | null>(null);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    adminApi.get<Notifications>("/admin/notifications").then(setNotifications).catch(() => {});
  }, [pathname]);

  if (pathname === "/admin/login") return <>{children}</>;

  async function markSeen() {
    await adminApi.post("/admin/notifications/mark-seen");
    setNotifications((n) => (n ? { ...n, totalCount: 0, items: [] } : n));
  }

  return (
    <ConfirmDialogProvider>
      <div className="flex min-h-screen flex-col bg-canvas md:flex-row">
        <AdminSidebar notifications={notifications} onMarkSeen={markSeen} />
        <div className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">{children}</div>
      </div>
    </ConfirmDialogProvider>
  );
}
