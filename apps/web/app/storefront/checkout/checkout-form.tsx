"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearLocalCart, getLocalCart, LocalCartItem } from "../../../lib/local-cart";
import { ResolvedThemeSettings } from "../../../lib/theme-presets";
import { createCartSession, ShippingAddressInput, submitCheckout } from "./actions";

const inputStyle = { padding: 10, borderRadius: 8, border: "1px solid #d1d5db", width: "100%" } as const;
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 14 };

/**
 * FR-15.1 (locked UX) - step 1 is email, and only email; nothing else is
 * collected (and no server-side cart exists) until it's submitted.
 */
export function CheckoutForm({
  hostname,
  currency,
  theme,
  savedAddress,
}: {
  hostname: string;
  currency: string;
  theme: ResolvedThemeSettings;
  /** FR-66.1 (Module 81) - "faster reorder": the logged-in buyer's default saved address, if any. */
  savedAddress?: ShippingAddressInput | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<LocalCartItem[] | null>(null);
  const [step, setStep] = useState<"email" | "shipping">("email");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [address, setAddress] = useState<ShippingAddressInput>(
    savedAddress ?? {
      fullName: "",
      line1: "",
      line2: "",
      city: "",
      country: "PK",
      postalCode: "",
      phone: "",
    },
  );
  const [discountCode, setDiscountCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(getLocalCart(hostname));
  }, [hostname]);

  if (items === null) return null;

  if (items.length === 0) {
    return (
      <div style={{ padding: "32px 0" }}>
        <p>Your cart is empty.</p>
        <a href="/cart" style={{ color: theme.colors.primary, fontWeight: 600 }}>
          &larr; Back to cart
        </a>
      </div>
    );
  }

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  async function continueFromEmail(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createCartSession(hostname, email, items ?? [], whatsapp.trim() || undefined);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSessionToken(result.sessionToken);
    setStep("shipping");
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setSubmitting(true);
    setError(null);
    const result = await submitCheckout(hostname, sessionToken, address, discountCode);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    clearLocalCart(hostname);
    router.push(`/order-confirmation/${result.statusLookupToken}`);
  }

  return (
    <div>
      <div style={{ marginBottom: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <strong>
          {items.length} item{items.length === 1 ? "" : "s"} - {currency} {subtotal.toFixed(2)}
        </strong>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
          Shipping, tax, and any discount are calculated once you place your order.
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={continueFromEmail} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={labelStyle}>
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
            />
          </label>
          <label style={labelStyle}>
            WhatsApp number (optional)
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              style={inputStyle}
              placeholder="03001234567"
            />
          </label>
          {error && <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: theme.colors.primary,
              color: "#fff",
              fontWeight: 600,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Please wait..." : "Continue"}
          </button>
        </form>
      )}

      {step === "shipping" && (
        <form onSubmit={placeOrder} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={labelStyle}>
            Full name
            <input
              required
              value={address.fullName}
              onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Address
            <input
              required
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Address line 2 (optional)
            <input value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} style={inputStyle} />
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              City
              <input
                required
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, width: 100 }}>
              Country
              <input
                required
                maxLength={2}
                value={address.country}
                onChange={(e) => setAddress({ ...address, country: e.target.value.toUpperCase() })}
                style={inputStyle}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              Postal code (optional)
              <input
                value={address.postalCode}
                onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              Phone
              <input
                required
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Discount code (optional)
            <input value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} style={inputStyle} />
          </label>
          {error && <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: theme.colors.primary,
              color: "#fff",
              fontWeight: 600,
              cursor: submitting ? "wait" : "pointer",
            }}
          >
            {submitting ? "Placing order..." : "Place order"}
          </button>
          <p style={{ fontSize: 12, color: "#6b7280" }}>
            You'll pay the seller directly - once they confirm receipt, your order moves to confirmed.
          </p>
        </form>
      )}
    </div>
  );
}
