"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { adminApi, AdminApiError } from "@/lib/admin-api";

interface TicketMessage {
  id: string;
  authorType: "seller" | "admin";
  body: string;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  status: "open" | "resolved";
  slaDeadline: string;
  createdAt: string;
  receiptPdfUrl: string | null;
  messages: TicketMessage[];
  store: { name: string };
}

/** SRS §5.6k/FR-8.18 (Module 90) - admin's side of the same thread a seller sees in support-center, plus reply and resolve. */
export default function AdminSupportTicketDetailPage({ params }: { params: { ticketId: string } }) {
  const confirm = useConfirm();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);

  function load() {
    adminApi
      .get<SupportTicket>(`/admin/support-tickets/${params.ticketId}`)
      .then(setTicket)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load this ticket."));
  }

  useEffect(load, [params.ticketId]);

  async function onReply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminApi.post(`/admin/support-tickets/${params.ticketId}/messages`, { body: reply });
      setReply("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't send that reply.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResolve() {
    const ok = await confirm({
      title: "Mark this ticket resolved?",
      description: "The seller will no longer be able to reply on this thread. They can always open a new ticket if the issue comes back.",
      confirmLabel: "Resolve",
    });
    if (!ok) return;
    setError(null);
    setResolving(true);
    try {
      await adminApi.post(`/admin/support-tickets/${params.ticketId}/resolve`, {});
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't resolve this ticket.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div>
      <Link href="/admin/support-tickets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      {!ticket ? (
        <PageSpinner />
      ) : (
        <>
          <PageHeader
            title={ticket.subject}
            description={`${ticket.store.name} · response-time commitment: by ${new Date(ticket.slaDeadline).toLocaleString()}`}
            action={
              <div className="flex items-center gap-3">
                <Badge tone={ticket.status === "open" ? "info" : "success"} dot>
                  {ticket.status === "open" ? "Open" : "Resolved"}
                </Badge>
                {ticket.receiptPdfUrl && (
                  <a href={ticket.receiptPdfUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <FileDown className="h-4 w-4" /> Receipt
                    </Button>
                  </a>
                )}
                {ticket.status === "open" && (
                  <Button variant="secondary" size="sm" loading={resolving} onClick={onResolve}>
                    Mark resolved
                  </Button>
                )}
              </div>
            }
          />

          {error && (
            <Alert className="mb-4" tone="danger">
              {error}
            </Alert>
          )}

          <Card className="mb-4">
            <CardHeader title="Conversation" />
            <CardBody className="space-y-4">
              {ticket.messages.map((m) => (
                <div key={m.id} className={m.authorType === "admin" ? "rounded-md bg-canvas p-3" : "rounded-md bg-surface p-3"}>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                    {m.authorType === "admin" ? "You (UZEYN support)" : "Seller"} · {new Date(m.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{m.body}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          {ticket.status === "open" && (
            <Card>
              <CardHeader title="Reply" />
              <CardBody>
                <form onSubmit={onReply} className="space-y-4">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} required rows={4} placeholder="Reply to the seller..." />
                  <Button type="submit" loading={submitting}>
                    Send reply
                  </Button>
                </form>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
