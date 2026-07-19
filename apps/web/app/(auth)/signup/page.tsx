"use client";

import { useState } from "react";

// Module 16 (SRS §5.25/FR-25.5) - launch is Pakistan-only; the rest of this
// list exists only so the "launching in your region soon" waitlist path is
// actually reachable from this form. Opening a new region is a Settings
// Registry write (auth.seller_signup_allowed_countries), never a frontend
// change - this list is just which countries a visitor can identify as,
// not which ones are allowed.
const COUNTRIES = [
  { code: "PK", name: "Pakistan" },
  { code: "IN", name: "India" },
  { code: "BD", name: "Bangladesh" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("PK");
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
      body: JSON.stringify({ email, password, businessName, country, agreementAccepted }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(`Error: ${body.message ?? res.statusText}`);
    } else if (body.waitlisted) {
      // SRS FR-25.5 - never an error: the applicant's email + country was
      // captured for future launch-campaign outreach instead.
      setStatus("goto5x.com is launching in your region soon - we've noted your interest and will be in touch.");
    } else {
      setStatus("Account created. Check your email for a verification link.");
    }
  }

  return (
    <main>
      <h1>Sign up</h1>
      <p>Create a seller account to start selling on goto5x.com.</p>
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
            Country
            <select value={country} onChange={(e) => setCountry(e.target.value)} required>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
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
