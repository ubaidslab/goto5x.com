"use client";

import { useState } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    // SRS §5.29/FR-29.1 - a seller must accept the current Seller Agreement
    // at signup; the checkbox below is required before submission is even
    // possible.
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, businessName, agreementAccepted }),
    });
    if (res.ok) {
      setStatus("Account created. Check your email for a verification link.");
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(`Error: ${body.message ?? res.statusText}`);
    }
  }

  return (
    <main>
      <h1>Sign up</h1>
      <form onSubmit={onSubmit}>
        <div>
          <label>
            Business name
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
          </label>
        </div>
        <div>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
        </div>
        <div>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={agreementAccepted}
              onChange={(e) => setAgreementAccepted(e.target.checked)}
              required
            />
            I accept the Seller Agreement (facilitation-workspace terms - goto5x.com is not a party to your sales or
            fulfillment, and you're responsible for your own listings and compliance).
          </label>
        </div>
        <button type="submit">Create account</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}
