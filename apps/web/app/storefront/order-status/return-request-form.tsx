"use client";

import { useState } from "react";
import type { PublicReturnRequest } from "../../../lib/storefront-api";
import { submitReturnRequest } from "./actions";

const STATUS_LABEL: Record<PublicReturnRequest["status"], string> = {
  requested: "Awaiting seller review",
  approved: "Approved - refund in progress",
  rejected: "Rejected",
  completed: "Refund completed",
};

/** FR-60.2/60.6 - submitted via the order-status link, same as ReviewForm; shows the latest request's own status once one exists instead of the form. */
export function ReturnRequestForm({
  token,
  canRequestReturn,
  currency,
  returnRequests,
}: {
  token: string;
  canRequestReturn: boolean;
  currency: string;
  returnRequests: PublicReturnRequest[];
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult("idle");
    try {
      const { ok } = await submitReturnRequest(token, { reason });
      if (!ok) throw new Error("failed");
      setResult("success");
      setReason("");
    } catch {
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  const latest = returnRequests[0];

  if (result === "success") {
    return <p>Your return request has been submitted. The seller will review it shortly.</p>;
  }

  if (latest && !canRequestReturn) {
    return (
      <div>
        <p>
          Return status: <strong>{STATUS_LABEL[latest.status]}</strong>
        </p>
        <p style={{ color: "#6b7280" }}>Your reason: {latest.buyerReason}</p>
        {latest.sellerNote && <p style={{ color: "#6b7280" }}>Seller note: {latest.sellerNote}</p>}
        {latest.refundAmount != null && (
          <p>
            Refund amount: {currency} {latest.refundAmount}
          </p>
        )}
      </div>
    );
  }

  if (!canRequestReturn) return null;

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
      <label>
        Reason for return
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} />
      </label>
      {result === "error" && <p style={{ color: "crimson" }}>Couldn't submit that request - please try again.</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Request a return"}
      </button>
    </form>
  );
}
