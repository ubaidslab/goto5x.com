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
  { label: "Products", href: (id) => `/stores/${id}/products`, builtInModule10: true },
  { label: "Collections", href: (id) => `/stores/${id}/collections`, builtInModule10: false },
  { label: "Discounts", href: (id) => `/stores/${id}/discounts`, builtInModule10: true },
  { label: "Shipping & tax", href: (id) => `/stores/${id}/shipping-tax`, builtInModule10: true },
  { label: "Navigation", href: (id) => `/stores/${id}/navigation`, builtInModule10: false },
  { label: "Suppliers", href: (id) => `/stores/${id}/suppliers`, builtInModule10: true, conditional: true },
  { label: "Theme", href: (id) => `/stores/${id}/customizer`, builtInModule10: false },
  { label: "Settings", href: (id) => `/stores/${id}/settings`, builtInModule10: false },
];
