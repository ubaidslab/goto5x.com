"use client";

import { useState } from "react";
import { addToLocalCart } from "../../../../lib/local-cart";
import { ResolvedThemeSettings } from "../../../../lib/theme-presets";
import { ShippingEstimate } from "../../shipping/shipping-estimate";

interface VariantOption {
  id: string;
  sku: string;
  price: string;
  stockQuantity: number;
}

/**
 * FR-32.1 - "add to cart" is purely client-side until the email-first
 * checkout step (FR-15.1) persists a real cart server-side; see
 * lib/local-cart.ts for why.
 */
export function AddToCartForm({
  hostname,
  productId,
  productTitle,
  variants,
  currency,
  theme,
}: {
  hostname: string;
  productId: string;
  productTitle: string;
  variants: VariantOption[];
  currency: string;
  theme: ResolvedThemeSettings;
}) {
  const inStock = variants.filter((v) => v.stockQuantity > 0);
  const [variantId, setVariantId] = useState(inStock[0]?.id ?? variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.id === variantId);
  if (!selected) {
    return <p style={{ color: "#b91c1c" }}>Out of stock.</p>;
  }

  function addToCart() {
    if (!selected) return;
    addToLocalCart(hostname, {
      productId,
      variantId: selected.id,
      quantity,
      title: productTitle,
      sku: selected.sku,
      unitPrice: Number(selected.price),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
      {variants.length > 1 && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
          Option
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.stockQuantity === 0}>
                {v.sku} - {currency} {v.price}
                {v.stockQuantity === 0 ? " (out of stock)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
        Quantity
        <input
          type="number"
          min={1}
          max={selected.stockQuantity}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.min(selected.stockQuantity, Number(e.target.value))))}
          style={{ padding: 8, borderRadius: 8, width: 100 }}
        />
      </label>
      <button
        onClick={addToCart}
        disabled={selected.stockQuantity === 0}
        style={{
          padding: "12px 20px",
          borderRadius: 8,
          border: "none",
          background: theme.colors.primary,
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: selected.stockQuantity === 0 ? "not-allowed" : "pointer",
          opacity: selected.stockQuantity === 0 ? 0.5 : 1,
        }}
      >
        {selected.stockQuantity === 0 ? "Out of stock" : `Add to cart - ${currency} ${(Number(selected.price) * quantity).toFixed(2)}`}
      </button>
      <ShippingEstimate
        hostname={hostname}
        currency={currency}
        items={[{ productId, variantId: selected.id, quantity }]}
      />
      {added && (
        <p style={{ fontSize: 13, color: theme.colors.primary }}>
          Added to cart. <a href="/cart" style={{ color: theme.colors.primary, fontWeight: 600 }}>View cart &rarr;</a>
        </p>
      )}
    </div>
  );
}
