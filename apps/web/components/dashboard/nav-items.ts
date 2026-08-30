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
 *   Settings hub (Phase 5, confirmed - the founder's own "Admin" group
 *     here is seller-facing and belongs to Operations/Phase 5; Phase 6
 *     is Module 25's fully separate platform-admin terminal, unaffected)
 *     absorbs: Domains (/domains), Store Health (/health), Verified Store
 *     (/verification), Import & export (/data).
 *
 * Payments and Reports are real, already-built features (Module 62 gateway
 * connect; Module 24 data export) that lived only inside Settings until
 * now. Payments was extracted into its own routed page (`/payments`)
 * alongside its Phase 5 visual redesign - see `payments/page.tsx`'s own doc
 * comment. Reports is still `/settings#reports`, an anchor link into the
 * still-single Settings page (real, working, no 404 - just not yet
 * extracted into its own page) - that extraction happens alongside the
 * Settings-hub phase above rather than moving 900+ lines of interdependent
 * state twice.
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
}

export const navItems: NavItem[] = [
  { label: "Home", href: (id) => `/stores/${id}`, icon: LayoutDashboard, group: "main" },
  { label: "Orders", href: (id) => `/stores/${id}/orders`, icon: ShoppingBag, group: "main" },
  { label: "Products", href: (id) => `/stores/${id}/products`, icon: Package, group: "main" },
  { label: "Inventory", href: (id) => `/stores/${id}/inventory`, icon: Boxes, group: "main" },
  { label: "Customers", href: (id) => `/stores/${id}/customers`, icon: Users, group: "main" },
  // Module 96 (SRS §5.4/FR-4.11, founder batch B13) - moved here from
  // "operations" and made unconditionally visible, reversing the original
  // UI/UX Design Phase decision (see this file's own history) that hid it
  // until a supplier link existed. Local dropshipping is a first-class,
  // discoverable capability now, not a screen a seller has to already
  // know about to ever find.
  { label: "Suppliers", href: (id) => `/stores/${id}/suppliers`, icon: Handshake, group: "main" },

  { label: "Analytics", href: (id) => `/stores/${id}/analytics`, icon: BarChart3, group: "growth" },
  { label: "Marketing", href: (id) => `/stores/${id}/marketing`, icon: Megaphone, group: "growth" },
  { label: "Reviews", href: (id) => `/stores/${id}/reviews`, icon: Star, group: "growth" },
  // D-Studio v1 - a real standalone, fullscreen design workspace (no
  // Sidebar/topbar chrome), so this deliberately points outside the
  // (dashboard) route group's layout tree (app/stores/[storeId]/d-studio/,
  // not app/(dashboard)/stores/[storeId]/...) - see that route's own
  // layout.tsx note. The old bare /customizer page still exists (kept for
  // its still-real coded-mode/branding/announcement-bar/WhatsApp-button
  // controls the new shell doesn't cover in v1) but is no longer the nav
  // destination.
  { label: "Design Studio", href: (id) => `/stores/${id}/d-studio`, icon: Palette, group: "growth" },

  { label: "Shipping & tracking", href: (id) => `/stores/${id}/shipping-tax`, icon: Truck, group: "operations" },
  { label: "Payments", href: (id) => `/stores/${id}/payments`, icon: CreditCard, group: "operations" },

  { label: "Reports", href: (id) => `/stores/${id}/settings#reports`, icon: FileText, group: "admin" },
  { label: "Staff", href: (id) => `/stores/${id}/staff-accounts`, icon: UserCog, group: "admin" },
  { label: "Billing & plan", href: (id) => `/stores/${id}/billing`, icon: Wallet, group: "admin" },
  { label: "Settings", href: (id) => `/stores/${id}/settings`, icon: SettingsIcon, group: "admin" },
];
