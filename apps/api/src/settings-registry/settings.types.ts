import { SettingsScopeType } from "@prisma/client";

export interface SettingsContext {
  sellerId?: string;
  storeId?: string;
  planId?: string;
  categoryId?: string;
  // Module 20 (SRS FR-7.10 supplement) - the supplier-side equivalent of
  // sellerId; a request context carries at most one of the two in
  // practice (a session is either a seller's or a supplier's, never both).
  supplierId?: string;
}

/**
 * Most-specific-wins, pinned in SRS §3.8: seller > store > supplier > plan >
 * category > global. `supplier` (new, Module 20) resolves with higher
 * precedence than `plan`, mirroring FR-8.1's seller > plan > global
 * pattern for the supplier side. A key only participates at the scopes in
 * its own `allowedScopes` - irrelevant scopes here are skipped, never
 * reordered.
 */
export const PRECEDENCE: SettingsScopeType[] = ["seller", "store", "supplier", "plan", "category", "global"];

export function scopeIdFor(scope: SettingsScopeType, context: SettingsContext): string | undefined {
  switch (scope) {
    case "seller":
      return context.sellerId;
    case "store":
      return context.storeId;
    case "plan":
      return context.planId;
    case "supplier":
      return context.supplierId;
    case "category":
      return context.categoryId;
    case "global":
      return undefined;
  }
}

/**
 * The reverse of scopeIdFor() - builds a single-scope SettingsContext from
 * one (scopeType, scopeId) pair. Module 92 (SRS §5.68/FR-68.3) uses this
 * so setLocked() can call resolve() with exactly the scope it's locking,
 * without needing every other scope's id as well.
 */
export function contextFromScope(scope: SettingsScopeType, scopeId: string | null): SettingsContext {
  if (scope === "global" || scopeId === null) return {};
  switch (scope) {
    case "seller":
      return { sellerId: scopeId };
    case "store":
      return { storeId: scopeId };
    case "plan":
      return { planId: scopeId };
    case "supplier":
      return { supplierId: scopeId };
    case "category":
      return { categoryId: scopeId };
  }
}
