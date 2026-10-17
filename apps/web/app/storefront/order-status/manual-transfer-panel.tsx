"use client";

import { useState } from "react";
import { submitManualTransferReference } from "./actions";

const panelStyle: React.CSSProperties = { padding: 16, borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 24 };
const labelStyle: React.CSSProperties = { display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
};

/**
 * B3b (founder decision, 2026-10-11) - the Advance payment model's
 * no-gateway Manual Transfer fallback: the buyer's self-reported
 * transaction reference + sender name, reviewed by the seller against
 * their own bank account (not itself proof of payment - see the warning
 * copy the seller dashboard shows alongside its confirm action). Mounted
 * alongside ModelAdvancePanel (never inside it) - the two are mutually
 * exclusive in practice today (no gateway is live, see B3a/D86), but
 * structured so both could show together once one is (a buyer picking
 * between a live gateway and a manual transfer is a normal choice, not a
 * conflict).
 */
export function ManualTransferPanel({
  token,
  paymentModel,
  orderStatus,
  initialReference,
  initialSenderName,
  initialSubmittedAt,
}: {
  token: string;
  paymentModel: "prepaid" | "cod" | "advance";
  orderStatus: string;
  initialReference: string | null;
  initialSenderName: string | null;
  initialSubmittedAt: string | null;
}) {
  const [reference, setReference] = useState("");
  const [senderName, setSenderName] = useState("");
  const [submitted, setSubmitted] = useState(initialReference !== null);
  const [submittedValues, setSubmittedValues] = useState({
    reference: initialReference,
    senderName: initialSenderName,
    submittedAt: initialSubmittedAt,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const applies = paymentModel === "advance" && orderStatus === "pending";
  if (!applies) return null;

  async function submit() {
    const trimmedReference = reference.trim();
    const trimmedSenderName = senderName.trim();
    if (!trimmedReference || !trimmedSenderName) {
      setError("Please fill in both fields.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await submitManualTransferReference(token, { reference: trimmedReference, senderName: trimmedSenderName });
    setLoading(false);
    if (result.ok) {
      setSubmitted(true);
      setSubmittedValues({ reference: trimmedReference, senderName: trimmedSenderName, submittedAt: new Date().toISOString() });
    } else {
      setError(result.message ?? "Couldn't submit this right now - please try again.");
    }
  }

  if (submitted) {
    return (
      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Manual transfer submitted</h2>
        <p style={{ color: "#6b7280" }}>
          {submittedValues.submittedAt ? `You told us you sent this on ${new Date(submittedValues.submittedAt).toLocaleString()}. ` : ""}
          The seller checks their own account before confirming - this page will update once they do.
        </p>
        <dl style={{ margin: 0 }}>
          <dt style={{ fontWeight: 600, fontSize: 14 }}>Reference</dt>
          <dd style={{ margin: "0 0 8px" }}>{submittedValues.reference}</dd>
          <dt style={{ fontWeight: 600, fontSize: 14 }}>Sender name</dt>
          <dd style={{ margin: 0 }}>{submittedValues.senderName}</dd>
        </dl>
      </div>
    );
  }

  const buttonBackground = loading ? "#9ca3af" : pressed ? "#030712" : hovered ? "#1f2937" : "#111827";

  return (
    <div style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>Submit your transfer details</h2>
      <p style={{ color: "#6b7280" }}>
        This store collects your advance via bank/mobile-wallet transfer - see &ldquo;How to pay&rdquo; below for the account details.
        Once you&apos;ve sent the payment, tell us the reference number and the name it was sent from, so the seller can match it to your
        order.
      </p>
      {/* A plain div, not a <form> - matches ModelAdvancePanel's own
          proven pattern on this exact page (a <button type="button">
          calling its server action directly from onClick). */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
        <div>
          <label htmlFor="manual-transfer-reference" style={labelStyle}>
            Transaction reference
          </label>
          <input
            id="manual-transfer-reference"
            name="reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={loading}
            maxLength={100}
            required
            aria-required="true"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="manual-transfer-sender-name" style={labelStyle}>
            Sender&apos;s name
          </label>
          <input
            id="manual-transfer-sender-name"
            name="senderName"
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            disabled={loading}
            maxLength={100}
            required
            aria-required="true"
            style={inputStyle}
          />
        </div>
        {error && (
          <p role="alert" style={{ color: "#991b1b", margin: 0, fontSize: 14, fontWeight: 600 }}>
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => {
            setHovered(false);
            setPressed(false);
          }}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            border: "none",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 14,
            background: buttonBackground,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.15s ease, transform 0.1s ease",
            transform: pressed && !loading ? "scale(0.98)" : "scale(1)",
          }}
        >
          {loading ? "Submitting..." : "I've sent the transfer"}
        </button>
      </div>
    </div>
  );
}
