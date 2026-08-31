import { StaffPermission, StaffScope } from "@prisma/client";

export interface StaffRoleTemplate {
  key: string;
  label: string;
  description: string;
  scopePermissions: { scope: StaffScope; permission: StaffPermission }[];
}

/**
 * SRS §5.52/FR-52.9 (founder batch "Staff Accounts Overhaul", founder-
 * approved set) - a static, versioned catalog, not a DB table: applying
 * one just pre-fills the same create/edit form every other scope
 * assignment already uses, so a seller can still add, remove, or flip any
 * individual scope's permission immediately after - a template is a
 * starting point, never a locked role. Adding a 7th template later is a
 * code change here, not a migration.
 */
export const STAFF_ROLE_TEMPLATES: StaffRoleTemplate[] = [
  {
    key: "order_manager",
    label: "Order Manager",
    description: "Processes and ships orders; can see customers and suppliers but not edit them.",
    scopePermissions: [
      { scope: "orders", permission: "write" },
      { scope: "customers", permission: "read" },
      { scope: "suppliers", permission: "read" },
    ],
  },
  {
    key: "product_designer",
    label: "Product Designer",
    description: "Manages the catalog and store design/theme.",
    scopePermissions: [
      { scope: "catalog", permission: "write" },
      { scope: "design", permission: "write" },
    ],
  },
  {
    key: "marketing_assistant",
    label: "Marketing Assistant",
    description: "Runs campaigns and discounts; can view analytics to track results.",
    scopePermissions: [
      { scope: "marketing", permission: "write" },
      { scope: "discounts", permission: "write" },
      { scope: "analytics", permission: "read" },
    ],
  },
  {
    key: "customer_support",
    label: "Customer Support",
    description: "Handles customers and reviews; can see orders but not change them.",
    scopePermissions: [
      { scope: "customers", permission: "write" },
      { scope: "reviews", permission: "write" },
      { scope: "orders", permission: "read" },
    ],
  },
  {
    key: "supplier_coordinator",
    label: "Supplier Coordinator",
    description: "Manages supplier relationships and listings; can see orders to know what needs forwarding.",
    scopePermissions: [
      { scope: "suppliers", permission: "write" },
      { scope: "orders", permission: "read" },
    ],
  },
  {
    key: "analyst",
    label: "Analyst",
    description: "Fully view-only across analytics, orders, and catalog - for an accountant or consultant.",
    scopePermissions: [
      { scope: "analytics", permission: "read" },
      { scope: "orders", permission: "read" },
      { scope: "catalog", permission: "read" },
    ],
  },
];
