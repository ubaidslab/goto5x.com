"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { Card, CardBody } from "@/components/ui/Card";

type Status = { kind: "verifying" } | { kind: "success" } | { kind: "error"; message: string };

/** Founder walkthrough finding (pre-Milestone-A, Phase 1 item 6) - restyled to match /login and /signup (was raw unstyled HTML). */
export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>({ kind: "verifying" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus({ kind: "error", message: "Missing verification token." });
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus({ kind: "success" });
        } else {
          const body = await res.json().catch(() => ({}));
          setStatus({ kind: "error", message: body.message ?? res.statusText });
        }
      })
      .catch(() => setStatus({ kind: "error", message: "Network error verifying your email - please try the link again." }));
  }, []);

  return (
    <AuthShell>
      <Card>
        <CardBody>
          <h1 className="text-h3 text-ink">Email verification</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Confirming the email address you signed up with.</p>

          <div className="mt-4">
            {status.kind === "verifying" && <Alert tone="info">Verifying…</Alert>}
            {status.kind === "success" && <Alert tone="success">Email verified. You can log in now.</Alert>}
            {status.kind === "error" && <Alert tone="danger">{status.message}</Alert>}
          </div>

          <Link href="/login" className="mt-5 inline-block text-sm font-medium text-accent underline-offset-2 hover:underline">
            Go to login
          </Link>
        </CardBody>
      </Card>
    </AuthShell>
  );
}
