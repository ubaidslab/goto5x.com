"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, ApiError } from "@/lib/dashboard-api";

/** SRS FR-8.20 (Module 99, founder batch B17) - the seller-facing ticket-creation form FR-8.18 always specified but never got a UI for. */
export default function SupportCenterNewTicketPage({ params }: { params: { storeId: string } }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem("accessToken")) {
      router.replace("/login");
    }
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const ticket = await api.post<{ id: string }>(`/stores/${params.storeId}/support-tickets`, { subject, body });
      router.push(`/stores/${params.storeId}/tickets/${ticket.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit that ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link href={`/stores/${params.storeId}/tickets`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      <PageHeader title="New support ticket" />

      <Card>
        <CardHeader title="What's going on?" description="A subject and a description are enough - no need to fill out a form." />
        <CardBody>
          {error && (
            <Alert className="mb-4" tone="danger">
              {error}
            </Alert>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Subject" htmlFor="ticket-subject">
              <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} />
            </Field>
            <Field label="Description">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={6} />
            </Field>
            <Button type="submit" loading={submitting}>
              Submit ticket
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
