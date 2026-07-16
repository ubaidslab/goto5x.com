"use client";

import { useState } from "react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // Always show the same message, whether or not the account exists.
    setStatus("If an account exists for that email, a reset link has been sent.");
  }

  async function completeReset(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/password-reset/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    if (res.ok) {
      setStatus("Password reset. You can log in with your new password.");
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`Error: ${body.message ?? res.statusText}`);
    }
  }

  if (token) {
    return (
      <main>
        <h1>Set a new password</h1>
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

  return (
    <main>
      <h1>Forgot password</h1>
      <form onSubmit={requestReset}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <button type="submit">Send reset link</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}
