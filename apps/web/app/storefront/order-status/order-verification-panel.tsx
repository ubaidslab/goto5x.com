"use client";

import { useEffect, useState } from "react";
import type { PublicOrderStatus } from "../../../lib/storefront-api";
import { chargePartialAdvance, getPartialAdvanceOptions, resendVerificationCode, submitVerificationCode } from "./actions";

const PROVIDER_LABEL: Record<string, string> = {
  raast: "Raast",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  bank: "Bank transfer",
};

/**
 * Launch-blocker fix (found while building Module 76's prepaid
 * partial-advance buyer UI) - the buyer-facing order-status/order-
 * confirmation pages never surfaced order verification at all, for ANY
 * channel: no OTP entry field existed anywhere on the storefront, so a
 * seller using whatsapp_otp or email_otp had buyers who could never
 * actually clear the gate their order was stuck behind. This component is
 * the one place all four channels (whatsapp_otp/email_otp/
 * prepaid_confirmation/prepaid_partial_advance) get a real, working buyer
 * action - mounted on both order-confirmation (first touch, right after
 * checkout) and order-status (every subsequent visit).
 */
export function OrderVerificationPanel({
  token,
  verification,
}: {
  token: string;
  verification: PublicOrderStatus["verification"];
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justVerified, setJustVerified] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const [advanceOptions, setAdvanceOptions] = useState<{ amount: number; currency: string; providers: string[] } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const isPartialAdvance = verification?.channel === "prepaid_partial_advance";

  useEffect(() => {
    if (!isPartialAdvance || verification?.status !== "pending") return;
    getPartialAdvanceOptions(token).then((options) => {
      setAdvanceOptions(options);
      if (options?.providers.length) setSelectedProvider(options.providers[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isPartialAdvance, verification?.status]);

  if (!verification) return null;

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitVerificationCode(token, code);
    setSubmitting(false);
    if (result.ok) {
      setJustVerified(true);
    } else {
      setError(result.message ?? "Incorrect or expired code.");
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    setResendSent(false);
    const result = await resendVerificationCode(token);
    setResending(false);
    if (result.ok) {
      setResendSent(true);
    } else {
      setError(result.message ?? "Couldn't resend a code right now.");
    }
  }

  async function payAdvance() {
    setAdvanceLoading(true);
    setAdvanceError(null);
    const result = await chargePartialAdvance(token, selectedProvider);
    setAdvanceLoading(false);
    if (result.ok) {
      setJustVerified(true);
    } else {
      setAdvanceError(result.message ?? "Payment could not be verified yet.");
    }
  }

  if (justVerified || verification.status === "verified") {
    return (
      <div style={{ padding: 16, borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", marginBottom: 24 }}>
        <p style={{ margin: 0, color: "#065f46", fontWeight: 600 }}>✓ Verified - your order is confirmed.</p>
      </div>
    );
  }

  if (verification.channel === "prepaid_confirmation") {
    return (
      <div style={{ padding: 16, borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Order verification</h2>
        <p style={{ margin: 0, color: "#6b7280" }}>
          {verification.status === "pending"
            ? "Awaiting the seller to confirm your payment was received. This can take a little time - no action is needed from you."
            : "This order's verification could not be completed - please contact the seller."}
        </p>
      </div>
    );
  }

  if (isPartialAdvance) {
    if (verification.status !== "pending") {
      return (
        <div style={{ padding: 16, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Order verification</h2>
          <p style={{ margin: 0, color: "#991b1b" }}>This order's deposit payment could not be verified - please contact the seller.</p>
        </div>
      );
    }
    return (
      <div style={{ padding: 16, borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Pay your deposit to confirm this order</h2>
        <p style={{ color: "#6b7280" }}>
          To confirm this is a real order, pay a small deposit now - the rest stays cash/payment on delivery, exactly as agreed at
          checkout.
        </p>
        {!advanceOptions ? (
          <p style={{ color: "#6b7280" }}>Loading payment options...</p>
        ) : advanceOptions.providers.length === 0 ? (
          <p style={{ color: "#991b1b" }}>No payment provider is available for this store right now - please contact the seller.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              Deposit due: {advanceOptions.currency} {advanceOptions.amount}
            </p>
            <label>
              Pay with
              <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
                {advanceOptions.providers.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABEL[p] ?? p}
                  </option>
                ))}
              </select>
            </label>
            {advanceError && <p style={{ color: "crimson", margin: 0 }}>{advanceError}</p>}
            <button type="button" onClick={payAdvance} disabled={advanceLoading}>
              {advanceLoading ? "Verifying payment..." : `Pay deposit (${advanceOptions.currency} ${advanceOptions.amount})`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // whatsapp_otp / email_otp
  if (verification.status === "pending" || verification.status === "expired" || verification.status === "failed") {
    return (
      <div style={{ padding: 16, borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Verify your order</h2>
        <p style={{ color: "#6b7280" }}>
          {verification.channel === "whatsapp_otp"
            ? "We sent a verification code to your WhatsApp. Enter it below to confirm this order."
            : "We emailed you a verification code. Enter it below to confirm this order."}
          {(verification.status === "expired" || verification.status === "failed") && " Your previous code is no longer valid - request a new one."}
        </p>
        <form onSubmit={submitCode} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
          <label>
            Verification code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              minLength={6}
              inputMode="numeric"
              required
              disabled={verification.status !== "pending"}
            />
          </label>
          {error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
          {resendSent && <p style={{ color: "#16a34a", margin: 0 }}>A new code has been sent.</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={submitting || verification.status !== "pending"}>
              {submitting ? "Verifying..." : "Verify"}
            </button>
            <button type="button" onClick={resend} disabled={resending}>
              {resending ? "Sending..." : "Resend code"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return null;
}
