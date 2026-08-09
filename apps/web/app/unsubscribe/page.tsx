"use client";

import { useEffect, useState } from "react";

export default function UnsubscribePage() {
  const [status, setStatus] = useState("Unsubscribing...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("Missing unsubscribe link.");
      return;
    }
    // Module 55 (SRS §5.62/FR-62.3) - a newsletter's unsubscribe link points
    // here with ?type=newsletter, reusing this page rather than a second
    // one, since the only difference is which endpoint the token is posted to.
    const isNewsletter = params.get("type") === "newsletter";
    const endpoint = isNewsletter ? "/newsletters/unsubscribe" : "/storefront/campaigns/unsubscribe";
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus(
            isNewsletter
              ? "You're unsubscribed. You won't receive any more UZEYN newsletter emails."
              : "You're unsubscribed. You won't receive any more campaign emails from this store.",
          );
        } else {
          const body = await res.json().catch(() => ({}));
          setStatus(`Error: ${body.message ?? res.statusText}`);
        }
      })
      .catch(() => setStatus("Network error unsubscribing."));
  }, []);

  return (
    <main>
      <h1>Unsubscribe</h1>
      <p>{status}</p>
    </main>
  );
}
