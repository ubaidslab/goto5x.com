/**
 * The seller dashboard's navigation shape. Centralized here (not duplicated
 * inside the sidebar component) so adding/reordering a section is a
 * one-line change - the same "one source of truth" discipline this
 * module's design tokens follow.
 *
 * `builtInModule10: false` entries point at Module 2/5/7's existing bare
 * functional pages (no design pass yet) - they stay in the nav so the
 * founder can see the full intended shape of the dashboard now, not just
 * the two screens this checkpoint restyled. They pick up this same visual
 * system in a later wave of this module, after the design direction below
 * is approved.
 */
export interface NavItem {
  label: string;
  href: (storeId: string) => string;
  builtInModule10: boolean;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: (id) => `/stores/${id}`, builtInModule10: true },
  { label: "Products", href: (id) => `/stores/${id}/products`, builtInModule10: true },
  { label: "Collections", href: (id) => `/stores/${id}/collections`, builtInModule10: false },
  { label: "Navigation", href: (id) => `/stores/${id}/navigation`, builtInModule10: false },
  { label: "Theme", href: (id) => `/stores/${id}/customizer`, builtInModule10: false },
  { label: "Settings", href: (id) => `/stores/${id}/settings`, builtInModule10: false },
];
