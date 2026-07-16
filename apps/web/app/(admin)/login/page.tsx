"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${apiBase}/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(`Error: ${body.message ?? res.statusText}`);
      return;
    }
    setPreAuthToken(body.preAuthToken);
    setMfaEnrolled(body.mfaEnrolled);
    if (!body.mfaEnrolled) {
      const enrollRes = await fetch(`${apiBase}/admin/auth/mfa/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preAuthToken: body.preAuthToken }),
      });
      const enrollBody = await enrollRes.json();
      setOtpauthUrl(enrollBody.otpauthUrl);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`${apiBase}/admin/auth/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preAuthToken, code }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      localStorage.setItem("adminAccessToken", body.accessToken);
      setStatus("Logged in.");
    } else {
      setStatus(`Error: ${body.message ?? res.statusText}`);
    }
  }

  if (preAuthToken) {
    return (
      <main>
        <h1>Admin MFA</h1>
        {!mfaEnrolled && otpauthUrl && (
          <p>
            First-time setup: scan this URI in an authenticator app, then enter a
            code: <code>{otpauthUrl}</code>
          </p>
        )}
        <form onSubmit={submitCode}>
          <label>
            6-digit code
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <button type="submit">Verify</button>
        </form>
        {status && <p>{status}</p>}
      </main>
    );
  }

  return (
    <main>
      <h1>Admin login</h1>
      <form onSubmit={submitLogin}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit">Continue</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}
