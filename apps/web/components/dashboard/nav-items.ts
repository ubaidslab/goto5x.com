/**
 * The seller dashboard's navigation shape. Centralized here (not duplicated
 * inside the sidebar component) so adding/reordering a section is a
 * one-line change - the same "one source of truth" discipline this
 * module's design tokens follow.
 *
 * `builtInModule10: false` entries point at Module 2/5's existing bare
 * functional pages (no design pass yet) - Navigation, Theme, and Settings
 * pick up this visual system in a later wave of this module.
 *
 * `conditional: true` marks an item Sidebar only renders when the caller
 * says it's relevant (currently just Suppliers - SIMPLICITY INVARIANT: a
 * self-fulfilled seller with no supplier connections never sees it).
 */
export interface NavItem {
  label: string;
  href: (storeId: string) => string;
  builtInModule10: boolean;
  conditional?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: (id) => `/stores/${id}`, builtInModule10: true },
  { label: "Orders", href: (id) => `/stores/${id}/orders`, builtInModule10: true },
  { label: "Returns & Refunds", href: (id) => `/stores/${id}/returns`, builtInModule10: false },
  { label: "Customers", href: (id) => `/stores/${id}/customers`, builtInModule10: true },
  { label: "Customer Segments", href: (id) => `/stores/${id}/customer-segments`, builtInModule10: false },
  { label: "Email Campaigns", href: (id) => `/stores/${id}/campaigns`, builtInModule10: false },
  { label: "Products", href: (id) => `/stores/${id}/products`, builtInModule10: true },
  { label: "Inventory", href: (id) => `/stores/${id}/inventory`, builtInModule10: false },
  { label: "Reviews", href: (id) => `/stores/${id}/reviews`, builtInModule10: true },
  { label: "Collections", href: (id) => `/stores/${id}/collections`, builtInModule10: false },
  { label: "Discounts", href: (id) => `/stores/${id}/discounts`, builtInModule10: true },
  { label: "Gift Cards", href: (id) => `/stores/${id}/gift-cards`, builtInModule10: false },
  { label: "Shipping & tax", href: (id) => `/stores/${id}/shipping-tax`, builtInModule10: true },
  { label: "Navigation", href: (id) => `/stores/${id}/navigation`, builtInModule10: false },
  { label: "Suppliers", href: (id) => `/stores/${id}/suppliers`, builtInModule10: true, conditional: true },
  { label: "Domains", href: (id) => `/stores/${id}/domains`, builtInModule10: true },
  { label: "Import & export", href: (id) => `/stores/${id}/data`, builtInModule10: true },
  { label: "WhatsApp recovery", href: (id) => `/stores/${id}/whatsapp`, builtInModule10: false },
  { label: "Profit & Loss", href: (id) => `/stores/${id}/pnl`, builtInModule10: false },
  { label: "Wallet", href: (id) => `/stores/${id}/wallet`, builtInModule10: true },
  { label: "Store Health", href: (id) => `/stores/${id}/health`, builtInModule10: true },
  { label: "Verified Store", href: (id) => `/stores/${id}/verification`, builtInModule10: true },
  { label: "Order Verification", href: (id) => `/stores/${id}/order-verification`, builtInModule10: false },
  { label: "Plans & Billing", href: (id) => `/stores/${id}/billing`, builtInModule10: true },
  { label: "Staff Accounts", href: (id) => `/stores/${id}/staff-accounts`, builtInModule10: false },
  { label: "Marketing", href: (id) => `/stores/${id}/marketing`, builtInModule10: true },
  { label: "Theme", href: (id) => `/stores/${id}/customizer`, builtInModule10: false },
  { label: "Settings", href: (id) => `/stores/${id}/settings`, builtInModule10: false },
];
