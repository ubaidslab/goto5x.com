import {
  BarChart3,
  Boxes,
  CreditCard,
  FileText,
  Handshake,
  LayoutDashboard,
  Megaphone,
  Package,
  Palette,
  Settings as SettingsIcon,
  ShoppingBag,
  Star,
  Truck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The seller dashboard's navigation shape - UI/UX Design Phase, founder-
 * locked information architecture (Part B item 7). Grouped into exactly
 * four sections (main/growth/operations/admin, in that order), matching
 * Shopify's own nav language and grouping. This is the FULL list of
 * top-level items - "no more, no less" per the founder's explicit
 * requirement. Every OTHER page this product has built still exists and
 * is still real/working - it just doesn't get its own top-level slot
 * any more. Each one is mapped below to the hub page (and future phase)
 * that will absorb it as an internal tab/section, so later phases execute
 * against one documented plan instead of improvising per-phase:
 *
 *   Orders hub (Phase 3) absorbs: Returns & Refunds (/returns),
 *     Order Verification (/order-verification, Module 26 - the founder's
 *     "headline differentiator," homed here per their own "under Orders
 *     or Settings" options rather than a 5th Main Menu slot).
 *   Products hub (Phase 3) absorbs: Collections (/collections).
 *   Analytics hub (Phase 4) absorbs: Profit & Loss (/pnl).
 *   Marketing hub (Phase 4) absorbs: the existing /marketing page itself
 *     (Social Media SaaS API-token hand-off), Campaigns (/campaigns),
 *     Customer Segments (/customer-segments), Gift Cards (/gift-cards),
 *     Discounts (/discounts), WhatsApp recovery (/whatsapp), and a NET-
 *     NEW tab surfacing Module 48's Facebook/Instagram feed URL + WhatsApp
 *     product-share link generator (real backend already built, no
 *     existing frontend anywhere yet - this is new frontend-only work,
 *     not new backend scope).
 *   Design Studio hub (Phase 4) absorbs: Customizer (/customizer),
 *     Navigation/nav-menu editor (/navigation). FR-1.6's "coded mode"
 *     escape hatch is deliberately still unbuilt (see lib/theme-presets.ts)
 *     and is NOT part of this hub.
 *   Settings hub (phase not yet assigned by the founder's Phase 1-8 list -
 *     flagged back explicitly, see Phase 1 report) absorbs: Domains
 *     (/domains), Store Health (/health), Verified Store (/verification),
 *     Import & export (/data).
 *
 * Payments and Reports are real, already-built features (Module 62 gateway
 * connect; Module 24 data export) that lived only inside Settings until
 * now. They get real top-level routes here, but as of Phase 1 those routes
 * are `/settings#payments` / `/settings#reports` anchor links into the
 * still-single Settings page (real, working, no 404 - just not yet
 * extracted into their own page) - true extraction into standalone routed
 * pages happens alongside their visual redesign (Payments in Phase 5;
 * Reports alongside the Settings-hub phase above) rather than moving 900+
 * lines of interdependent state twice.
 */
export type NavGroup = "main" | "growth" | "operations" | "admin";

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  main: "Main menu",
  growth: "Growth",
  operations: "Operations",
  admin: "Admin",
};

export interface NavItem {
  label: string;
  href: (storeId: string) => string;
  icon: LucideIcon;
  group: NavGroup;
  conditional?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Home", href: (id) => `/stores/${id}`, icon: LayoutDashboard, group: "main" },
  { label: "Orders", href: (id) => `/stores/${id}/orders`, icon: ShoppingBag, group: "main" },
  { label: "Products", href: (id) => `/stores/${id}/products`, icon: Package, group: "main" },
  { label: "Inventory", href: (id) => `/stores/${id}/inventory`, icon: Boxes, group: "main" },
  { label: "Customers", href: (id) => `/stores/${id}/customers`, icon: Users, group: "main" },

  { label: "Analytics", href: (id) => `/stores/${id}/analytics`, icon: BarChart3, group: "growth" },
  { label: "Marketing", href: (id) => `/stores/${id}/marketing`, icon: Megaphone, group: "growth" },
  { label: "Reviews", href: (id) => `/stores/${id}/reviews`, icon: Star, group: "growth" },
  { label: "Design Studio", href: (id) => `/stores/${id}/customizer`, icon: Palette, group: "growth" },

  { label: "Shipping & tracking", href: (id) => `/stores/${id}/shipping-tax`, icon: Truck, group: "operations" },
  { label: "Suppliers", href: (id) => `/stores/${id}/suppliers`, icon: Handshake, group: "operations", conditional: true },
  { label: "Payments", href: (id) => `/stores/${id}/settings#payments`, icon: CreditCard, group: "operations" },

  { label: "Reports", href: (id) => `/stores/${id}/settings#reports`, icon: FileText, group: "admin" },
  { label: "Staff", href: (id) => `/stores/${id}/staff-accounts`, icon: UserCog, group: "admin" },
  { label: "Billing & plan", href: (id) => `/stores/${id}/billing`, icon: Wallet, group: "admin" },
  { label: "Settings", href: (id) => `/stores/${id}/settings`, icon: SettingsIcon, group: "admin" },
];
