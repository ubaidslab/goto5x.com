import { PublicStore } from "../../lib/storefront-api";
import { getUnlockToken } from "./unlock-cookie";

export type AccessResult =
  | { gated: false; unlockToken?: string }
  | { gated: true; reason: "coming_soon" }
  | { gated: true; reason: "password_protected" };

/**
 * FR-16.5 - decides whether this request should see the real storefront or
 * one of the two gate pages. `coming_soon` never has an escape hatch;
 * `password_protected` checks for a cookie set by unlock-action.ts. The API
 * itself still enforces this independently on every product/search/
 * collection call (SRS mobile-app-readiness NFR) - this is just what
 * decides which page component to render.
 */
export function resolveAccess(store: PublicStore): AccessResult {
  if (store.accessMode === "public") return { gated: false };
  if (store.accessMode === "coming_soon") return { gated: true, reason: "coming_soon" };
  const unlockToken = getUnlockToken(store.id);
  if (!unlockToken) return { gated: true, reason: "password_protected" };
  return { gated: false, unlockToken };
}
