"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  { href: "/admin/verification", label: "Verified Store" },
  { href: "/admin/moderation", label: "Moderation queue" },
  { href: "/admin/trust-safety", label: "Trust & Safety" },
  { href: "/admin/growth-programs/applications", label: "Growth: applications" },
  { href: "/admin/growth-programs/content-submissions", label: "Growth: content" },
  { href: "/admin/growth-programs/withdrawals", label: "Growth: withdrawals" },
  { href: "/admin/careers", label: "Careers" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/supplier-adapters", label: "Supplier adapters" },
  { href: "/admin/settings", label: "Settings Registry" },
  { href: "/admin/audit-log", label: "Audit log" },
  { href: "/admin/status", label: "System status" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/external-api-clients", label: "External API clients" },
  { href: "/admin/content-pages", label: "Content pages" },
  { href: "/admin/messages", label: "Messages" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 220, borderRight: "1px solid #ccc", padding: 12, flexShrink: 0 }}>
        <p style={{ fontWeight: "bold", marginBottom: 8 }}>Admin</p>
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
