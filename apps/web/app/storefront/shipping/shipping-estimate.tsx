"use client";

import { useEffect, useState } from "react";
import { getShippingQuoteAction } from "./actions";

interface ShippingEstimateItem {
  productId: string;
  variantId: string;
  quantity: number;
}

/**
 * FR-66.4 (Module 84) - shipping cost calculator on product/cart pages,
 * replacing the static "calculated at checkout" disclaimer with the real
 * number (same flat-rate/free-threshold math checkout itself computes -
 * see CartService.quoteShipping()). Re-quotes whenever the item set
 * (variant/quantity selection) changes.
 */
export function ShippingEstimate({
  hostname,
  currency,
  items,
}: {
  hostname: string;
  currency: string;
  items: ShippingEstimateItem[];
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; shippingAmount: number; freeShippingThreshold: number | null; amountUntilFreeShipping: number | null }
  >({ status: "loading" });

  const itemsKey = JSON.stringify(items);

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    setState({ status: "loading" });
    getShippingQuoteAction(hostname, items).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setState({ status: "error" });
        return;
      }
      setState({
        status: "ready",
        shippingAmount: res.shippingAmount,
        freeShippingThreshold: res.freeShippingThreshold,
        amountUntilFreeShipping: res.amountUntilFreeShipping,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostname, itemsKey]);

  if (items.length === 0 || state.status === "error") return null;

  if (state.status === "loading") {
    return <p style={{ fontSize: 13, color: "#6b7280" }}>Estimating shipping&hellip;</p>;
  }

  const { shippingAmount, amountUntilFreeShipping } = state;
  return (
    <p style={{ fontSize: 13, color: "#6b7280" }}>
      {shippingAmount === 0 ? (
        <span style={{ fontWeight: 600, color: "#15803d" }}>Free shipping</span>
      ) : (
        <>
          Shipping: {currency} {shippingAmount.toFixed(2)}
        </>
      )}
      {amountUntilFreeShipping !== null && amountUntilFreeShipping > 0 && (
        <>
          {" "}
          &mdash; add {currency} {amountUntilFreeShipping.toFixed(2)} more for free shipping
        </>
      )}
    </p>
  );
}
