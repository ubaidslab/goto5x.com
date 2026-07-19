"use client";

/**
 * FR-15.1 (locked UX decision) - a cart is only persisted server-side once
 * the email-first checkout step completes. Before that, "add to cart" is
 * purely client-side state - this is that state, namespaced per storefront
 * hostname so browsing two different stores in one browser never merges
 * their carts.
 */
export interface LocalCartItem {
  productId: string;
  variantId: string;
  quantity: number;
  title: string;
  sku: string;
  unitPrice: number;
}

const KEY_PREFIX = "goto5x_cart_";
const UPDATED_EVENT = "goto5x-cart-updated";

function keyFor(hostname: string): string {
  return `${KEY_PREFIX}${hostname}`;
}

export function getLocalCart(hostname: string): LocalCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(hostname));
    return raw ? (JSON.parse(raw) as LocalCartItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalCart(hostname: string, items: LocalCartItem[]): void {
  window.localStorage.setItem(keyFor(hostname), JSON.stringify(items));
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export function addToLocalCart(hostname: string, item: LocalCartItem): void {
  const items = getLocalCart(hostname);
  const existing = items.find((i) => i.variantId === item.variantId);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    items.push(item);
  }
  saveLocalCart(hostname, items);
}

export function updateLocalCartQuantity(hostname: string, variantId: string, quantity: number): void {
  const items = getLocalCart(hostname)
    .map((i) => (i.variantId === variantId ? { ...i, quantity } : i))
    .filter((i) => i.quantity > 0);
  saveLocalCart(hostname, items);
}

export function removeFromLocalCart(hostname: string, variantId: string): void {
  saveLocalCart(
    hostname,
    getLocalCart(hostname).filter((i) => i.variantId !== variantId),
  );
}

export function clearLocalCart(hostname: string): void {
  saveLocalCart(hostname, []);
}

export function localCartCount(hostname: string): number {
  return getLocalCart(hostname).reduce((sum, i) => sum + i.quantity, 0);
}

/** Fires on every local-cart mutation, including cross-tab via the native `storage` event. */
export function onLocalCartChange(callback: () => void): () => void {
  window.addEventListener(UPDATED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(UPDATED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
