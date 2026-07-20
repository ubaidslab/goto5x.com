"use client";

import { useEffect, useState } from "react";

/**
 * v0.23 impersonation-transparency amendment (FR-8.4) - a persistent,
 * unmissable banner for the entire duration of an impersonation session.
 * "Exit" here is a local/soft exit (clears this browser tab's stored
 * token) - the authoritative end (audit-logged) happens from the admin's
 * own tab, which is the only place holding an admin-authenticated token.
 */
export function SupportModeBanner() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(localStorage.getItem("impersonationSessionId"));
  }, []);

  if (!sessionId) return null;

  function exit() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("impersonationSessionId");
    window.close();
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-warning px-4 py-2 text-sm font-medium text-on-accent">
      <span>Support mode - you are browsing as this seller.</span>
      <button className="underline" onClick={exit}>
        Exit support mode
      </button>
    </div>
  );
}
