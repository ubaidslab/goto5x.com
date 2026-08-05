"use client";

import { useEffect, useState } from "react";

export default function UnsubscribePage() {
  const [status, setStatus] = useState("Unsubscribing...");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("Missing unsubscribe link.");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/storefront/campaigns/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("You're unsubscribed. You won't receive any more campaign emails from this store.");
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
