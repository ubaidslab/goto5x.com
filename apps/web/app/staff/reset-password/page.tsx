"use client";

import { useEffect, useState } from "react";

/**
 * FR-52.15 (Module 101, founder batch B14) - "reset-not-reveal": the only
 * staff-facing frontend surface that exists anywhere in this codebase
 * today (StaffAuthService.login() has never had a UI built for it - a
 * pre-existing gap, not fixed here). Deliberately as bare-functional as
 * the existing seller (auth)/reset-password page, matching its own tier
 * of effort exactly. Completion-only - reachable only via the link an
 * admin-triggered reset emails to the staff member; there is no
 * self-service "request" form here.
 */
export default function StaffResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  // Read the token only after mount - reading window.location.search directly
  // in the render body would return null during SSR (no window) and the
  // real value on the client's first render, a client/server text mismatch
  // that trips React hydration.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function completeReset(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/staff/auth/password-reset/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    if (res.ok) {
      setStatus("Password reset. You can now log in with your new password.");
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`Error: ${body.message ?? res.statusText}`);
    }
  }

  if (token === undefined) {
    return <main />;
  }

  if (!token) {
    return (
      <main>
        <h1>Invalid link</h1>
        <p>This password reset link is missing its token. Ask your store owner to have the admin trigger a new reset.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Set a new password</h1>
      <p>Choose a new password for your staff account.</p>
      <form onSubmit={completeReset}>
        <label>
          New password
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={10} />
        </label>
        <button type="submit">Reset password</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}
