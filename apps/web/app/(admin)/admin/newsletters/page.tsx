"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";

interface Newsletter {
  id: string;
  subject: string;
  body: string;
  status: "draft" | "sending" | "sent" | "failed";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  failureReason: string | null;
  createdAt: string;
  sentAt: string | null;
}

const STATUS_TONE: Record<Newsletter["status"], "neutral" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  sending: "warning",
  sent: "success",
  failed: "danger",
};

/**
 * Phase 6g (Admin Terminal re-skin) - Module 55 (SRS §5.62/FR-62.2)'s
 * admin-composed platform newsletter, restyled onto DashCard. Every
 * action preserved: compose/save-as-draft, send (confirm-gated with typed
 * "SEND" confirmation - the single highest-blast-radius action in the
 * admin terminal).
 */
export default function AdminNewslettersPage() {
  const confirm = useConfirm();
  const [newsletters, setNewsletters] = useState<Newsletter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  function load() {
    adminApi
      .get<Newsletter[]>("/admin/newsletters")
      .then(setNewsletters)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load newsletters."));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await adminApi.post("/admin/newsletters", { subject, body });
      setSubject("");
      setBody("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't create that newsletter.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSend(id: string, subject: string, recipientCount: number) {
    const ok = await confirm({
      title: `Send "${subject}" to every seller?`,
      description: `This broadcasts to all ${recipientCount} sellers who haven't opted out. This is the single highest-blast-radius action in the admin terminal and cannot be undone once sending starts.`,
      confirmLabel: "Send now",
      tone: "danger",
      typedConfirmation: "SEND",
    });
    if (!ok) return;
    setError(null);
    setSendingId(id);
    try {
      await adminApi.post(`/admin/newsletters/${id}/send`);
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't send that newsletter.");
    } finally {
      setSendingId(null);
    }
  }

  if (error && !newsletters) return <Alert tone="danger">{error}</Alert>;
  if (!newsletters) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Newsletters"
        description="Compose and send a one-off email to every seller who hasn't opted out (SRS §5.62/FR-62.2). Sent from UZEYN's own SMTP identity, not a seller's connected mailbox. Opt-out is re-checked live at send time, not at creation - a seller who unsubscribes after you draft this still won't receive it."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-3xl space-y-4">
        <DashCard className="divide-y divide-border">
          {newsletters.length === 0 ? (
            <p className="py-3 text-sm text-ink-muted">No newsletters yet.</p>
          ) : (
            newsletters.map((n) => (
              <div key={n.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    {n.subject}
                    <Badge tone={STATUS_TONE[n.status]}>{n.status}</Badge>
                  </p>
                  {n.status === "failed" && n.failureReason && <p className="text-xs text-danger">{n.failureReason}</p>}
                  <p className="text-xs text-ink-muted">
                    {n.recipientCount} recipients · {n.sentCount} sent · {n.failedCount} failed
                  </p>
                  <p className="text-xs text-ink-faint">
                    Created {new Date(n.createdAt).toLocaleString()} {n.sentAt && `· sent ${new Date(n.sentAt).toLocaleString()}`}
                  </p>
                </div>
                {n.status === "draft" && (
                  <Button size="sm" onClick={() => handleSend(n.id, n.subject, n.recipientCount)} disabled={sendingId === n.id}>
                    {sendingId === n.id ? "Sending..." : "Send"}
                  </Button>
                )}
              </div>
            ))
          )}
        </DashCard>

        <DashCard>
          <DashCardHeader title="Compose a new newsletter" />
          <form onSubmit={handleCreate} className="space-y-3">
            <Field label="Subject">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} />
            </Field>
            <Field label="Body" hint="Plain text body.">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} required />
            </Field>
            <Button type="submit" disabled={creating}>
              {creating ? "Saving..." : "Save as draft"}
            </Button>
          </form>
        </DashCard>
      </div>
    </div>
  );
}
