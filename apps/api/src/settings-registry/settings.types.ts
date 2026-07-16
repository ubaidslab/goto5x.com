import { SettingsScopeType } from "@prisma/client";

export interface SettingsContext {
  sellerId?: string;
  storeId?: string;
  planId?: string;
  categoryId?: string;
}

/**
 * Most-specific-wins, pinned in SRS §3.8: seller > store > plan > category >
 * global. A key only participates at the scopes in its own
 * `allowedScopes` - irrelevant scopes here are skipped, never reordered.
 */
export const PRECEDENCE: SettingsScopeType[] = ["seller", "store", "plan", "category", "global"];

export function scopeIdFor(scope: SettingsScopeType, context: SettingsContext): string | undefined {
  switch (scope) {
    case "seller":
      return context.sellerId;
    case "store":
      return context.storeId;
    case "plan":
      return context.planId;
    case "category":
      return context.categoryId;
    case "global":
      return undefined;
  }
}
