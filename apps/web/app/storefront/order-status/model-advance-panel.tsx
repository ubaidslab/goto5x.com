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
  const [selectedProvider, setSelectedProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  const applies = paymentModel === "advance" && orderStatus === "pending";

  useEffect(() => {
    if (!applies) return;
    getModelAdvanceOptions(token).then((result) => {
      setOptions(result);
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

  return (
    <div style={{ padding: 16, borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 24 }}>
      <h2 style={{ marginTop: 0 }}>Pay your advance to confirm this order</h2>
      <p style={{ color: "#6b7280" }}>
        This store collects a percentage of your order upfront - the rest stays cash/payment on delivery, exactly as agreed at
        checkout.
      </p>
      {!options ? (
        <p style={{ color: "#6b7280" }}>Loading payment options...</p>
      ) : options.providers.length === 0 ? (
        <p style={{ color: "#991b1b" }}>No payment provider is available for this store right now - please contact the seller.</p>
      ) : (
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
      )}
    </div>
  );
}
