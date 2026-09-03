"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { getApiErrorMessage } from "@/lib/api-error";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

function storeTokens(body: { accessToken: string; sessionId: string; refreshToken: string }) {
  localStorage.setItem("accessToken", body.accessToken);
  localStorage.setItem("sessionId", body.sessionId);
  localStorage.setItem("refreshToken", body.refreshToken);
}

/**
 * SRS FR-8.20 (Module 99, founder batch B17) - support.uzeyn.com is a
 * different origin from app.uzeyn.com (where the seller dashboard's own
 * session lives), and this platform's auth tokens are stored in
 * per-origin localStorage, so a seller authenticates here separately with
 * the same account and the same /auth/login (+ MFA) flow the dashboard
 * login page uses - not a second identity, and not a cut-down flow either
 * (an MFA-enrolled seller must be able to log in here just as fully as on
 * the dashboard). A real constraint, not a design choice (see FR-8.20's
 * own text for the deferred SSO-cookie fix).
 */
export default function SupportCenterLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setError(getApiErrorMessage(body, res.statusText));
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
      router.push("/");
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
        router.push("/");
      } else {
        setError(getApiErrorMessage(body, res.statusText));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (preAuthToken) {
    const secret = otpauthUrl ? new URL(otpauthUrl).searchParams.get("secret") : null;

    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardBody>
            <h1 className="text-h4 text-ink">Confirm it&apos;s you</h1>
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
              <Field label="6-digit code" htmlFor="support-login-mfa-code">
                <Input
                  id="support-login-mfa-code"
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
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardBody>
          <h1 className="text-h4 text-ink">Log in</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Sign in with your UZEYN seller account to reach the Support Center.</p>

          {error && (
            <Alert className="mt-4" tone="danger">
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Field label="Email" htmlFor="support-login-email">
              <Input
                id="support-login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </Field>
            <Field label="Password" htmlFor="support-login-password">
              <Input
                id="support-login-password"
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
    </div>
  );
}
