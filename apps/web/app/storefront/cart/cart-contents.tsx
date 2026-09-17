"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../../../lib/motion";
import {
  getLocalCart,
  LocalCartItem,
  onLocalCartChange,
  removeFromLocalCart,
  updateLocalCartQuantity,
} from "../../../lib/local-cart";
import { ResolvedThemeSettings } from "../../../lib/theme-presets";
import { ShippingEstimate } from "../shipping/shipping-estimate";

/**
 * Founder-approved Phase 4e (storefront motion pass) - cart gets light,
 * functional micro-feedback only (confirming an action registered), never
 * page-load entrance choreography like the browse pages' AnimatedElement
 * presets - those are scroll-triggered, once-only, and the wrong tool for
 * "this quantity change/removal just happened." A plain imperative GSAP
 * tween tied directly to the mutation is used instead.
 */
function CartLineRow({
  item,
  currency,
  onQuantityChange,
  onRemove,
}: {
  item: LocalCartItem;
  currency: string;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const removingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Skip the flash on first mount - only a real quantity change (not the
    // initial render) should pulse.
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (prefersReducedMotion() || !totalRef.current) return;
    gsap.fromTo(totalRef.current, { scale: 1.12 }, { scale: 1, duration: 0.3, ease: "power2.out" });
  }, [item.quantity]);

  function handleRemove() {
    if (removingRef.current || !rowRef.current) {
      onRemove();
      return;
    }
    removingRef.current = true;
    if (prefersReducedMotion()) {
      onRemove();
      return;
    }
    gsap.to(rowRef.current, {
      opacity: 0,
      height: 0,
      paddingTop: 0,
      paddingBottom: 0,
      marginBottom: 0,
      duration: 0.25,
      ease: "power2.in",
      onComplete: onRemove,
    });
  }

  return (
    <div
      ref={rowRef}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Founder walkthrough finding (Phase 1 item 12) - the cart never
          rendered a product image at all (no field to render even
          existed); imageUrl is snapshotted at add-to-cart time
          (local-cart.ts), so an item added before this fix simply
          renders without a thumbnail instead of a broken-image icon. */}
      {item.imageUrl && (
        <img
          // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded external MinIO URL, not a static/local asset
          src={item.imageUrl}
          alt=""
          style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{item.title}</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>{item.sku}</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          {currency} {item.unitPrice.toFixed(2)} each
        </div>
      </div>
      <input
        type="number"
        min={1}
        value={item.quantity}
        onChange={(e) => onQuantityChange(Math.max(1, Number(e.target.value)))}
        style={{ width: 64, padding: 8, borderRadius: 8, border: "1px solid #d1d5db" }}
      />
      <div ref={totalRef} style={{ width: 96, textAlign: "right", fontWeight: 600 }}>
        {currency} {(item.unitPrice * item.quantity).toFixed(2)}
      </div>
      <button
        onClick={handleRemove}
        style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer", fontSize: 13 }}
      >
        Remove
      </button>
    </div>
  );
}

export function CartContents({
  hostname,
  currency,
  theme,
}: {
  hostname: string;
  currency: string;
  theme: ResolvedThemeSettings;
}) {
  const [items, setItems] = useState<LocalCartItem[] | null>(null);

  useEffect(() => {
    const load = () => setItems(getLocalCart(hostname));
    load();
    return onLocalCartChange(load);
  }, [hostname]);

  if (items === null) return null;

  if (items.length === 0) {
    return (
      <div style={{ padding: "32px 0" }}>
        <p>Your cart is empty.</p>
        <a href="/" style={{ color: theme.colors.primary, fontWeight: 600 }}>
          &larr; Continue shopping
        </a>
      </div>
    );
  }

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((item) => (
        <CartLineRow
          key={item.variantId}
          item={item}
          currency={currency}
          onQuantityChange={(quantity) => updateLocalCartQuantity(hostname, item.variantId, quantity)}
          onRemove={() => removeFromLocalCart(hostname, item.variantId)}
        />
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, paddingTop: 8 }}>
        <span>Subtotal</span>
        <span>
          {currency} {subtotal.toFixed(2)}
        </span>
      </div>
      <ShippingEstimate
        hostname={hostname}
        currency={currency}
        items={items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }))}
      />
      <p style={{ fontSize: 13, color: "#6b7280" }}>Tax and any discount are calculated at checkout.</p>
      <a
        href="/checkout"
        style={{
          display: "inline-block",
          textAlign: "center",
          padding: "14px 20px",
          borderRadius: 8,
          background: theme.colors.primary,
          color: "#fff",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Proceed to checkout
      </a>
    </div>
  );
}
