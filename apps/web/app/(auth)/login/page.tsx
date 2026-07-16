"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      localStorage.setItem("accessToken", body.accessToken);
      localStorage.setItem("sessionId", body.sessionId);
      localStorage.setItem("refreshToken", body.refreshToken);
      setStatus("Logged in.");
    } else {
      setStatus(`Error: ${body.message ?? res.statusText}`);
    }
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
