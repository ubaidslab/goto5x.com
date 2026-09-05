"use client";

import { useState } from "react";
import { ResolvedThemeSettings } from "../../../lib/theme-presets";
import { addWishlistItemAction, removeWishlistItemAction } from "../account/actions";

/**
 * FR-66.5 (Module 85) - the product-page "save for later" heart toggle,
 * plan-gated RISE+FLY (same `enabled` prop pattern as ChatWidget - the
 * early return sits after every hook, never before/between them). A
 * logged-out buyer sees a sign-in link instead of a broken toggle, since
 * wishlist has no guest-accessible path (unlike buyer chat).
 */
export function WishlistButton({
  productId,
  enabled,
  loggedIn,
  initiallyWishlisted,
  theme,
}: {
  productId: string;
  enabled: boolean;
  loggedIn: boolean;
  initiallyWishlisted: boolean;
  theme: ResolvedThemeSettings;
}) {
  const [wishlisted, setWishlisted] = useState(initiallyWishlisted);
  const [pending, setPending] = useState(false);

  if (!enabled) return null;

  if (!loggedIn) {
    return (
      <a href="/account/login" style={{ fontSize: 13, color: "#6b7280", textDecoration: "underline" }}>
        Sign in to save for later
      </a>
    );
  }

  async function toggle() {
    setPending(true);
    const next = !wishlisted;
    setWishlisted(next);
    const res = next ? await addWishlistItemAction(productId) : await removeWishlistItemAction(productId);
    if (!res.ok) setWishlisted(!next);
    setPending(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 8,
        padding: "8px 14px",
        background: wishlisted ? theme.colors.primary : "none",
        color: wishlisted ? "#fff" : theme.colors.text,
        cursor: pending ? "wait" : "pointer",
        fontSize: 14,
      }}
    >
      {wishlisted ? "♥ Saved" : "♡ Save for later"}
    </button>
  );
}
