import {
  Banknote,
  BarChart3,
  Briefcase,
  CreditCard,
  Database,
  FileText,
  Gavel,
  Globe,
  Handshake,
  Home,
  Landmark,
  LayoutGrid,
  Mail,
  MessageSquare,
  Newspaper,
  Palette,
  Receipt,
  RefreshCcw,
  ScrollText,
  Search,
  Send,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavGroup = "overview" | "commerce" | "trust" | "growth" | "platform" | "content";

export const ADMIN_NAV_GROUP_LABELS: Record<AdminNavGroup, string> = {
  overview: "Overview",
  commerce: "Commerce & Finance",
  trust: "Orders, Trust & Safety",
  growth: "Growth Programs",
  platform: "Platform",
  content: "Content & Comms",
};

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: AdminNavGroup;
}

/**
 * Phase 6 (Admin Terminal re-skin) - grouped, iconed version of the exact
 * same flat NAV_LINKS list `admin/layout.tsx` had before this pass. Every
 * single link that existed is still here, unchanged in destination - this
 * is a restyle/reorganization, never a capability removal (founder's
 * standing directive). Grouping is purely presentational (visual sections
 * in the sidebar), not a new information-architecture decision requiring
 * sign-off the way the seller dashboard's nav consolidation was.
 */
export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "Home", icon: Home, group: "overview" },
  { href: "/admin/search", label: "Search", icon: Search, group: "overview" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, group: "overview" },
  { href: "/admin/status", label: "System status", icon: Globe, group: "overview" },

  { href: "/admin/sellers", label: "Sellers", icon: Users, group: "commerce" },
  { href: "/admin/finance", label: "Finance Terminal", icon: Landmark, group: "commerce" },
  { href: "/admin/invoices", label: "Wallet top-ups", icon: Banknote, group: "commerce" },
  { href: "/admin/payment-instructions", label: "Payment instructions", icon: Receipt, group: "commerce" },
  { href: "/admin/platform-gateway", label: "Platform merchant", icon: CreditCard, group: "commerce" },
  { href: "/admin/commission-invoices", label: "Commission invoices", icon: FileText, group: "commerce" },
  { href: "/admin/plans", label: "Plans", icon: LayoutGrid, group: "commerce" },
  { href: "/admin/categories", label: "Categories", icon: LayoutGrid, group: "commerce" },
  { href: "/admin/supplier-adapters", label: "Supplier adapters", icon: Truck, group: "commerce" },

  { href: "/admin/returns", label: "Returns & Refunds", icon: RefreshCcw, group: "trust" },
  { href: "/admin/verification", label: "Verified Store", icon: ShieldCheck, group: "trust" },
  { href: "/admin/moderation", label: "Moderation queue", icon: Gavel, group: "trust" },
  { href: "/admin/trust-safety", label: "Trust & Safety", icon: ShieldAlert, group: "trust" },

  { href: "/admin/growth-programs/applications", label: "Growth: applications", icon: Handshake, group: "growth" },
  { href: "/admin/growth-programs/content-submissions", label: "Growth: content", icon: TrendingUp, group: "growth" },
  { href: "/admin/growth-programs/withdrawals", label: "Growth: withdrawals", icon: Banknote, group: "growth" },
  { href: "/admin/careers", label: "Careers", icon: Briefcase, group: "growth" },

  { href: "/admin/settings", label: "Settings Registry", icon: SettingsIcon, group: "platform" },
  { href: "/admin/design-tokens", label: "Design tokens", icon: Palette, group: "platform" },
  { href: "/admin/audit-log", label: "Audit log", icon: ScrollText, group: "platform" },
  { href: "/admin/external-api-clients", label: "External API clients", icon: Database, group: "platform" },

  { href: "/admin/content-pages", label: "Content pages", icon: Newspaper, group: "content" },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare, group: "content" },
  { href: "/admin/email", label: "Email", icon: Mail, group: "content" },
  { href: "/admin/newsletters", label: "Newsletters", icon: Send, group: "content" },
];
