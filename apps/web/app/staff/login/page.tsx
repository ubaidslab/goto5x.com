"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { getApiErrorMessage } from "@/lib/api-error";
import { api } from "@/lib/dashboard-api";
import { redirectAfterAuth } from "@/lib/post-auth-redirect";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * D116 item 4 (Stage 0) - closes D111's own flagged gap: StaffAuthService.
 * login() has existed since D111, with no UI ever built for it. No MFA
 * sub-step (staff login has none, unlike seller/admin) - straight from
 * credentials to a session. Shares dashboard-api.ts's session store with
 * the seller dashboard (a staff token carries the same sellerId claim a
 * seller's own token does, see staff-auth.service.ts's signAccessToken())
 * so a staff member lands on and uses the exact same (dashboard) UI,
 * scoped down by StaffScopeGuard per-route - never a separate staff UI.
 * The one actor-specific difference (refresh/logout hit /staff/auth/*,
 * not /auth/*, and use their own __Host-staff_refresh_token cookie) is
 * handled by passing "staff" to api.setSession() - see that file's own
 * comment on actorKind.
 */
export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/staff/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(getApiErrorMessage(body, res.statusText));
        return;
      }
      api.setSession(body.accessToken, body.sessionId, "staff");
      await redirectAfterAuth(router, body.accessToken);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell eyebrow="Staff">
      <Card>
        <CardBody>
          <h1 className="text-h3 text-ink">Staff login</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Sign in with the staff account your store owner set up for you.</p>

          {error && (
            <Alert className="mt-4" tone="danger">
              {error}
            </Alert>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Field label="Email" htmlFor="staff-login-email">
              <Input
                id="staff-login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </Field>
            <Field label="Password" htmlFor="staff-login-password">
              <Input
                id="staff-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" className="w-full" loading={submitting}>
              Sign in
            </Button>
          </form>
        </CardBody>
      </Card>
    </AuthShell>
  );
}
