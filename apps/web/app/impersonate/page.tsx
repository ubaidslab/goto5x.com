"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/dashboard-api";

/**
 * v0.23 impersonation-transparency amendment (FR-8.4) - the bridge an
 * admin's "Impersonate" click opens in a new tab. Sets the impersonation
 * token via dashboard-api.ts's own setSession() (so every existing
 * dashboard screen/api client Just Works - same in-memory store, D82),
 * plus the session id the support-mode banner reads, then lands on the
 * seller's first store.
 *
 * D82 - the destination navigation below is a client-side router.push(),
 * not window.location.replace(): the access token now lives only in this
 * tab's in-memory module state, which a hard navigation would discard
 * before the destination page ever got to use it. impersonationSessionId
 * stays in localStorage deliberately - unlike the access token, it isn't a
 * bearer credential (nothing can authenticate as anything with just this
 * id), so it falls outside the "nothing may remain in localStorage" rule's
 * actual concern (credential exposure via XSS), and SupportModeBanner
 * (mounted separately, after this navigation) still needs a way to read it.
 */
export default function ImpersonateEntryPage() {
  const router = useRouter();
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
    api.setSession(token);
    if (sessionId) localStorage.setItem("impersonationSessionId", sessionId);

    fetch(`${apiBase}/stores`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((stores: { id: string }[]) => {
        if (stores.length > 0) {
          router.push(`/stores/${stores[0].id}`);
        } else {
          setError("This seller has no stores yet.");
        }
      })
      .catch(() => setError("Couldn't start the support session."));
  }, [apiBase, router]);

  return (
    <main style={{ padding: 24 }}>
      <p>{error ?? "Starting support session..."}</p>
    </main>
  );
}
