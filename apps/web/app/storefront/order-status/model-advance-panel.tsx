"use client";

import { useEffect, useState } from "react";
import { chargeModelAdvance, getModelAdvanceOptions } from "./actions";

const PROVIDER_LABEL: Record<string, string> = {
  raast: "Raast",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  bank: "Bank transfer",
};

/**
 * Module 95 (SRS §5.6l/FR-6.66) - the store-wide Advance payment model's
 * buyer-facing payment step, mounted alongside (never inside)
 * OrderVerificationPanel - deliberately independent of `verification`,
 * since the payment model and the order-verification channel are two
 * separate settings that can each be configured or not, in any
 * combination (FR-6.67's one narrow exception aside).
 */
export function ModelAdvancePanel({
  token,
  paymentModel,
  orderStatus,
}: {
  token: string;
  paymentModel: "prepaid" | "cod" | "advance";
  orderStatus: string;
}) {
  const [options, setOptions] = useState<{ amount: number; currency: string; providers: string[] } | null>(null);
  // B3b (founder decision, 2026-10-11) - found while verifying this panel
  // alongside ManualTransferPanel: a store with no gateway connection at
  // all (this B3b scenario, by far the common case today) makes
  // getModelAdvanceOptions() resolve to `null` (its own 404 branch), which
  // is indistinguishable from "hasn't resolved yet" if `options` alone is
  // the only signal - the panel got stuck on "Loading payment options..."
  // forever instead of stepping aside. This separate flag is the fix.
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  const applies = paymentModel === "advance" && orderStatus === "pending";

  useEffect(() => {
    if (!applies) return;
    getModelAdvanceOptions(token).then((result) => {
      setOptions(result);
      setOptionsLoaded(true);
      if (result?.providers.length) setSelectedProvider(result.providers[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, applies]);

  if (!applies) return null;

  async function payAdvance() {
    setLoading(true);
    setError(null);
    const result = await chargeModelAdvance(token, selectedProvider);
    setLoading(false);
    if (result.ok) {
      setJustPaid(true);
    } else {
      setError(result.message ?? "Payment could not be verified yet.");
    }
  }

  if (justPaid) {
    return (
      <div style={{ padding: 16, borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", marginBottom: 24 }}>
        <p style={{ margin: 0, color: "#065f46", fontWeight: 600 }}>✓ Advance paid - your order is confirmed. The remainder is due on delivery.</p>
      </div>
    );
  }

  if (!optionsLoaded) {
    return (
      <div style={{ padding: 16, borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 24 }}>
        <p style={{ color: "#6b7280", margin: 0 }}>Loading payment options...</p>
      </div>
    );
  }

  // B3b (founder decision, 2026-10-11) - no live gateway (empty/missing
  // `providers`, including a `null` result from no gateway connection at
  // all) is no longer an error state here: it just means this store's
  // advance order was placed via Manual Transfer instead
  // (ManualTransferPanel, mounted alongside this component, is the UI for
  // that case) - showing "no provider available" here would be wrong,
  // not just unhelpful, once that panel exists.
  if (!options || options.providers.length === 0) return null;

  return (
    <div style={{ padding: 16, borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>Pay your advance to confirm this order</h2>
      <p style={{ color: "#6b7280" }}>
        This store collects a percentage of your order upfront - the rest stays cash/payment on delivery, exactly as agreed at
        checkout.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>
          Advance due: {options.currency} {options.amount}
        </p>
        <label>
          Pay with
          <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
            {options.providers.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL[p] ?? p}
              </option>
            ))}
          </select>
        </label>
        {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
        <button type="button" onClick={payAdvance} disabled={loading}>
          {loading ? "Verifying payment..." : `Pay advance (${options.currency} ${options.amount})`}
        </button>
      </div>
    </div>
  );
}
