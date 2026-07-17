import { cookies } from "next/headers";

/** One cookie per store id - a buyer could plausibly visit two gated stores in one browser. */
export function unlockCookieName(storeId: string): string {
  return `storefront_unlock_${storeId}`;
}

export function getUnlockToken(storeId: string): string | undefined {
  return cookies().get(unlockCookieName(storeId))?.value;
}
