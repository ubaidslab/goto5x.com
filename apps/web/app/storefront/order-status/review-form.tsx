"use client";

import { useState } from "react";
import { submitReview } from "./actions";

/** FR-14.1 - submitted via the order-status link, never an account. */
export function ReviewForm({ token, items }: { token: string; items: { productId: string; productTitle: string }[] }) {
  const [productId, setProductId] = useState(items[0]?.productId ?? "");
  const [buyerName, setBuyerName] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult("idle");
    try {
      const { ok } = await submitReview(token, { productId, buyerName, rating, body });
      if (!ok) throw new Error("failed");
      setResult("success");
      setBuyerName("");
      setBody("");
    } catch {
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) return null;

  if (result === "success") {
    return <p>Thanks for your review! It'll appear once the seller approves it.</p>;
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
      <label>
        Product
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          {items.map((item) => (
            <option key={item.productId} value={item.productId}>
              {item.productTitle}
            </option>
          ))}
        </select>
      </label>
      <label>
        Your name
        <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
      </label>
      <label>
        Rating
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Review
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} />
      </label>
      {result === "error" && <p style={{ color: "crimson" }}>Couldn't submit that review - please try again.</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit review"}
      </button>
    </form>
  );
}
