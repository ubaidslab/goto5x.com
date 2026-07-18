"use client";

import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function storeTokens(body: { accessToken: string; sessionId: string; refreshToken: string }) {
  localStorage.setItem("accessToken", body.accessToken);
  localStorage.setItem("sessionId", body.sessionId);
  localStorage.setItem("refreshToken", body.refreshToken);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  // SRS §5.25/FR-25.6 - set once login() returns a pre-auth step instead of
  // tokens directly (an unenrolled seller under required_always
  // enforcement, or any already-enrolled account).
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(`Error: ${body.message ?? res.statusText}`);
      return;
    }
    if (body.preAuthToken) {
      setPreAuthToken(body.preAuthToken);
      if (!body.mfaEnrolled) {
        const enroll = await fetch(`${apiBase}/auth/mfa/enroll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preAuthToken: body.preAuthToken }),
        }).then((r) => r.json());
        setOtpauthUrl(enroll.otpauthUrl);
      }
      return;
    }
    storeTokens(body);
    setStatus("Logged in.");
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(`${apiBase}/auth/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preAuthToken, code }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      storeTokens(body);
      setStatus("Logged in.");
      setPreAuthToken(null);
    } else {
      setStatus(`Error: ${body.message?.message ?? body.message ?? res.statusText}`);
    }
  }

  if (preAuthToken) {
    return (
      <main>
        <h1>Two-factor authentication</h1>
        {otpauthUrl && (
          <div>
            <p>Scan this into an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code below:</p>
            <p style={{ wordBreak: "break-all" }}>{otpauthUrl}</p>
          </div>
        )}
        <form onSubmit={onSubmitCode}>
          <label>
            6-digit code
            <input value={code} onChange={(e) => setCode(e.target.value)} required maxLength={6} />
          </label>
          <button type="submit">Verify</button>
        </form>
        {status && <p>{status}</p>}
      </main>
    );
  }

  return (
    <main>
      <h1>Log in</h1>
      <form onSubmit={onSubmit}>
        <div>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
        </div>
        <div>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
        </div>
        <button type="submit">Log in</button>
      </form>
      {status && <p>{status}</p>}
      <p>
        <a href="/reset-password">Forgot password?</a>
      </p>
    </main>
  );
}
