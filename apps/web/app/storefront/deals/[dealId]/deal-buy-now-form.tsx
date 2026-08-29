"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitCheckout, ShippingAddressInput } from "../../checkout/actions";
import { ResolvedThemeSettings } from "../../../../lib/theme-presets";
import { buyNowDeal } from "../actions";

const inputStyle = { padding: 10, borderRadius: 8, border: "1px solid #d1d5db", width: "100%" } as const;
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 14 };

/**
 * FR-67.2 - "buy now" is a shortcut into the SAME checkout pipeline as an
 * ordinary cart: step 1 (email) calls buyNowDeal() instead of
 * createCartSession() to get a sessionToken, then step 2 (shipping) calls
 * the exact same submitCheckout() action checkout-form.tsx uses - nothing
 * about order placement itself is duplicated or reimplemented here.
 */
export function DealBuyNowForm({
  hostname,
  dealId,
  currency,
  theme,
  disabled,
}: {
  hostname: string;
  dealId: string;
  currency: string;
  theme: ResolvedThemeSettings;
  disabled: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "shipping">("email");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [address, setAddress] = useState<ShippingAddressInput>({
    fullName: "",
    line1: "",
    line2: "",
    city: "",
    country: "PK",
    postalCode: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueFromEmail(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await buyNowDeal(hostname, dealId, email, whatsapp.trim() || undefined);
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
    const result = await submitCheckout(hostname, sessionToken, address);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/order-confirmation/${result.statusLookupToken}`);
  }

  if (step === "email") {
    return (
      <form onSubmit={continueFromEmail} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
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
          disabled={submitting || disabled}
          style={{
            padding: "14px 20px",
            borderRadius: 8,
            border: "none",
            background: theme.colors.primary,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting || disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {disabled ? "Currently unavailable" : submitting ? "Please wait..." : "Buy this deal"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={placeOrder} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
      <label style={labelStyle}>
        Full name
        <input required value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} style={inputStyle} />
      </label>
      <label style={labelStyle}>
        Address
        <input required value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} style={inputStyle} />
      </label>
      <label style={labelStyle}>
        Address line 2 (optional)
        <input value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} style={inputStyle} />
      </label>
      <div style={{ display: "flex", gap: 12 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          City
          <input required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} style={inputStyle} />
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
          <input value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          Phone
          <input required value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} style={inputStyle} />
        </label>
      </div>
      {error && <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "14px 20px",
          borderRadius: 8,
          border: "none",
          background: theme.colors.primary,
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: submitting ? "wait" : "pointer",
        }}
      >
        {submitting ? "Placing order..." : "Place order"}
      </button>
      <p style={{ fontSize: 12, color: "#6b7280" }}>
        Prices shown are {currency}. You'll pay the seller directly - once they confirm receipt, your order moves to confirmed.
      </p>
    </form>
  );
}
