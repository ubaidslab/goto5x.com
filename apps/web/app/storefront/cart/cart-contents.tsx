"use client";

import { useEffect, useState } from "react";
import {
  getLocalCart,
  LocalCartItem,
  onLocalCartChange,
  removeFromLocalCart,
  updateLocalCartQuantity,
} from "../../../lib/local-cart";
import { ResolvedThemeSettings } from "../../../lib/theme-presets";
import { ShippingEstimate } from "../shipping/shipping-estimate";

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
        <div
          key={item.variantId}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
          }}
        >
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
            onChange={(e) => updateLocalCartQuantity(hostname, item.variantId, Math.max(1, Number(e.target.value)))}
            style={{ width: 64, padding: 8, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
          <div style={{ width: 96, textAlign: "right", fontWeight: 600 }}>
            {currency} {(item.unitPrice * item.quantity).toFixed(2)}
          </div>
          <button
            onClick={() => removeFromLocalCart(hostname, item.variantId)}
            style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer", fontSize: 13 }}
          >
            Remove
          </button>
        </div>
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
