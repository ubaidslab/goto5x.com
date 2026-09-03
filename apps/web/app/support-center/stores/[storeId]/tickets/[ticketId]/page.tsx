"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/dashboard-api";

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
}

/** SRS FR-8.20 (Module 99, founder batch B17) - ticket detail: thread, reply, and the new downloadable PDF receipt. */
export default function SupportCenterTicketDetailPage({ params }: { params: { storeId: string; ticketId: string } }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem("accessToken")) {
      router.replace("/login");
    }
  }, [router]);

  function load() {
    api
      .get<SupportTicket>(`/stores/${params.storeId}/support-tickets/${params.ticketId}`)
      .then(setTicket)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this ticket."));
  }

  useEffect(load, [params.storeId, params.ticketId]);

  async function onReply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/stores/${params.storeId}/support-tickets/${params.ticketId}/messages`, { body: reply });
      setReply("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that reply.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link href={`/stores/${params.storeId}/tickets`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      {!ticket ? (
        <PageSpinner />
      ) : (
        <>
          <PageHeader
            title={ticket.subject}
            description={`Response-time commitment: by ${new Date(ticket.slaDeadline).toLocaleString()}`}
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
                    {m.authorType === "admin" ? "UZEYN support" : "You"} · {new Date(m.createdAt).toLocaleString()}
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
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} required rows={4} placeholder="Add more detail..." />
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
