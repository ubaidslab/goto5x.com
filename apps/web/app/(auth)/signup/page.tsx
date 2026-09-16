"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input, Select } from "@/components/ui/Field";

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

type Outcome = { kind: "waitlisted" } | { kind: "created" } | null;

/**
 * Founder walkthrough finding (pre-Milestone-A, Phase 1 item 6) - this page
 * used to be entirely unstyled (raw <input>/<label>/<button>, no design-
 * system components) while /login was already styled (Founder batch A1) -
 * the visual mismatch, combined with neither page navigating anywhere on
 * success, is almost certainly what read as "shows content in a popup/
 * modal instead of a real page." Now matches AuthShell/Card/Field the same
 * way /login does. Signup itself still can't redirect straight into the
 * dashboard (a seller must verify their email first - see verify-email/
 * page.tsx), but success now replaces the form with a real, distinct
 * confirmation state instead of a status line squeezed in above still-
 * visible empty inputs.
 */
export default function SignupPage() {
  const [role, setRole] = useState<"seller" | "supplier">("seller");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("PK");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // SRS §5.29/FR-29.1 - a seller must accept the current Seller
      // Agreement at signup; the checkbox below is required before
      // submission is even possible. Module 20 (FR-7.10) - a supplier
      // signup skips country/agreement entirely, matching AuthService.
      // signup()'s existing role branching.
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          businessName,
          role,
          ...(role === "seller" ? { country, agreementAccepted } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? res.statusText);
        return;
      }
      // SRS FR-25.5 - never an error: the applicant's email + country was
      // captured for future launch-campaign outreach instead.
      setOutcome(body.waitlisted ? { kind: "waitlisted" } : { kind: "created" });
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome) {
    return (
      <AuthShell>
        <Card>
          <CardBody>
            <h1 className="text-h3 text-ink">{outcome.kind === "waitlisted" ? "You're on the list" : "Check your email"}</h1>
            <Alert className="mt-4" tone="success">
              {outcome.kind === "waitlisted"
                ? "uzeyn.com is launching in your region soon - we've noted your interest and will be in touch."
                : "Account created. We've sent a verification link to your email - open it, then log in."}
            </Alert>
            <Link href="/login" className="mt-5 inline-block text-sm font-medium text-accent underline-offset-2 hover:underline">
              Go to login
            </Link>
          </CardBody>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card>
        <CardBody>
          <h1 className="text-h3 text-ink">Sign up</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Start selling, or fulfill orders for sellers, on uzeyn.com.</p>

          {error && (
            <Alert className="mt-4" tone="danger">
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="radio" name="role" checked={role === "seller"} onChange={() => setRole("seller")} className="accent-accent" />
                Seller
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="radio" name="role" checked={role === "supplier"} onChange={() => setRole("supplier")} className="accent-accent" />
                Supplier
              </label>
            </div>

            <Field label="Business name" htmlFor="signup-business-name">
              <Input
                id="signup-business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Email" htmlFor="signup-email">
              <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field label="Password" htmlFor="signup-password">
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
            </Field>

            {role === "seller" && (
              <>
                <Field label="Country" htmlFor="signup-country">
                  <Select id="signup-country" value={country} onChange={(e) => setCountry(e.target.value)} required>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <label className="flex items-start gap-2.5 text-xs text-ink-muted">
                  <Checkbox
                    checked={agreementAccepted}
                    onCheckedChange={(checked) => setAgreementAccepted(checked === true)}
                    required
                    className="mt-0.5"
                  />
                  I accept the Seller Agreement (facilitation-workspace terms - uzeyn.com is not a party to your sales
                  or fulfillment, and you&apos;re responsible for your own listings and compliance).
                </label>
              </>
            )}

            <Button type="submit" className="w-full" loading={submitting}>
              Create account
            </Button>
          </form>
        </CardBody>
      </Card>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline-offset-2 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
