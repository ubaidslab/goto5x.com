"use client";

import { useEffect, useState } from "react";

/**
 * v0.23 impersonation-transparency amendment (FR-8.4) - the bridge an
 * admin's "Impersonate" click opens in a new tab. Stores the impersonation
 * token under the same "accessToken" key a normal seller login uses (so
 * every existing dashboard screen/api client Just Works), plus the session
 * id the support-mode banner reads, then lands on the seller's first store.
 */
export default function ImpersonateEntryPage() {
  const [error, setError] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const sessionId = params.get("sessionId");
    if (!token) {
      setError("Missing impersonation token.");
      return;
    }
    localStorage.setItem("accessToken", token);
    if (sessionId) localStorage.setItem("impersonationSessionId", sessionId);

    fetch(`${apiBase}/stores`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((stores: { id: string }[]) => {
        if (stores.length > 0) {
          window.location.replace(`/stores/${stores[0].id}`);
        } else {
          setError("This seller has no stores yet.");
        }
      })
      .catch(() => setError("Couldn't start the support session."));
  }, [apiBase]);

  return (
    <main style={{ padding: 24 }}>
      <p>{error ?? "Starting support session..."}</p>
    </main>
  );
}
