"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { getAuthErrorMessage } from "@/lib/auth-error";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function storeTokens(body: { accessToken: string; sessionId: string; refreshToken: string }) {
  localStorage.setItem("accessToken", body.accessToken);
  localStorage.setItem("sessionId", body.sessionId);
  localStorage.setItem("refreshToken", body.refreshToken);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // SRS §5.25/FR-25.6 - set once login() returns a pre-auth step instead of
  // tokens directly (an unenrolled seller under required_always
  // enforcement, or any already-enrolled account).
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(getAuthErrorMessage(body, res.statusText));
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
      setLoggedIn(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/auth/mfa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preAuthToken, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        storeTokens(body);
        setLoggedIn(true);
        setPreAuthToken(null);
      } else {
        setError(getAuthErrorMessage(body, res.statusText));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (preAuthToken) {
    // The secret is the same one embedded in otpauthUrl - pulled out here
    // so first-time setup shows a short, typeable string instead of the
    // full otpauth:// URI (still correct for anyone who prefers to paste
    // the URI directly into their authenticator app).
    const secret = otpauthUrl ? new URL(otpauthUrl).searchParams.get("secret") : null;

    return (
      <AuthShell eyebrow="Two-factor authentication">
        <Card>
          <CardBody>
            <h1 className="text-h3 text-ink">Confirm it&apos;s you</h1>
            <p className="mt-1.5 text-sm text-ink-muted">Enter the 6-digit code from your authenticator app.</p>

            {otpauthUrl && (
              <div className="mt-4 rounded-md border border-border bg-canvas p-3">
                <p className="text-xs text-ink-muted">
                  First-time setup: add this key to an authenticator app (Google Authenticator, Authy, etc.), then
                  enter the code it shows below.
                </p>
                <p className="mt-2 break-all rounded border border-border-strong bg-surface px-2 py-1.5 font-mono text-xs text-ink">
                  {secret}
                </p>
              </div>
            )}

            {error && (
              <Alert className="mt-4" tone="danger">
                {error}
              </Alert>
            )}

            <form onSubmit={onSubmitCode} className="mt-5 space-y-4">
              <Field label="6-digit code" htmlFor="login-mfa-code">
                <Input
                  id="login-mfa-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </Field>
              <Button type="submit" className="w-full" loading={submitting}>
                Verify
              </Button>
            </form>
          </CardBody>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card>
        <CardBody>
          <h1 className="text-h3 text-ink">Log in</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Sign in to manage your store.</p>

          {loggedIn && (
            <Alert className="mt-4" tone="success">
              Logged in.
            </Alert>
          )}
          {error && (
            <Alert className="mt-4" tone="danger">
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Field label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" className="w-full" loading={submitting}>
              Log in
            </Button>
          </form>
        </CardBody>
      </Card>
      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/reset-password" className="text-accent underline-offset-2 hover:underline">
          Forgot password?
        </Link>
      </p>
    </AuthShell>
  );
}
