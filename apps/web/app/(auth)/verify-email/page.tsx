"use client";

import { useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState("Verifying...");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("Missing verification token.");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("Email verified. You can log in now.");
        } else {
          const body = await res.json().catch(() => ({}));
          setStatus(`Error: ${body.message ?? res.statusText}`);
        }
      })
      .catch(() => setStatus("Network error verifying email."));
  }, []);

  return (
    <main>
      <h1>Email verification</h1>
      <p>Confirming the email address you signed up with.</p>
      <p>{status}</p>
      <a href="/login">Go to login</a>
    </main>
  );
}
