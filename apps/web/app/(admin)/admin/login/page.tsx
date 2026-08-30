"use client";

import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { getAuthErrorMessage } from "@/lib/auth-error";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(getAuthErrorMessage(body, res.statusText));
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
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/admin/auth/mfa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preAuthToken, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        localStorage.setItem("adminAccessToken", body.accessToken);
        setLoggedIn(true);
      } else {
        setError(getAuthErrorMessage(body, res.statusText));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (preAuthToken) {
    const secret = otpauthUrl ? new URL(otpauthUrl).searchParams.get("secret") : null;

    return (
      <AuthShell eyebrow="Admin">
        <Card>
          <CardBody>
            <h1 className="text-h3 text-ink">Admin MFA</h1>
            <p className="mt-1.5 text-sm text-ink-muted">Confirm your identity with a one-time code to finish signing in.</p>

            {!mfaEnrolled && otpauthUrl && (
              <div className="mt-4 rounded-md border border-border bg-canvas p-3">
                <p className="text-xs text-ink-muted">
                  First-time setup: add this key to an authenticator app, then enter the code it shows below.
                </p>
                <p className="mt-2 break-all rounded border border-border-strong bg-surface px-2 py-1.5 font-mono text-xs text-ink">
                  {secret}
                </p>
              </div>
            )}

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

            <form onSubmit={submitCode} className="mt-5 space-y-4">
              <Field label="6-digit code" htmlFor="admin-login-mfa-code">
                <Input
                  id="admin-login-mfa-code"
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
    <AuthShell eyebrow="Admin">
      <Card>
        <CardBody>
          <h1 className="text-h3 text-ink">Admin login</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Sign in with your platform admin credentials.</p>

          {error && (
            <Alert className="mt-4" tone="danger">
              {error}
            </Alert>
          )}

          <form onSubmit={submitLogin} className="mt-5 space-y-4">
            <Field label="Email" htmlFor="admin-login-email">
              <Input
                id="admin-login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </Field>
            <Field label="Password" htmlFor="admin-login-password">
              <Input
                id="admin-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" className="w-full" loading={submitting}>
              Continue
            </Button>
          </form>
        </CardBody>
      </Card>
    </AuthShell>
  );
}
