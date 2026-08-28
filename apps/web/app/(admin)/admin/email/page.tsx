"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";

interface LinkedAccount {
  id: string;
  emailAddress: string;
  displayName: string | null;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  createdAt: string;
}

interface InboxMessage {
  accountId: string;
  accountEmailAddress: string;
  uid: number;
  from: string;
  subject: string;
  date: string | null;
  snippet: string;
}

/**
 * Phase 6g (Admin Terminal re-skin) - Module 36 (SRS §5.53/FR-53.1-53.5)'s
 * unified inbox in the admin terminal, restyled onto DashCard. Every
 * action preserved: link account, test connection, unlink (confirm-gated),
 * read inbox, reply. Converted from hand-rolled fetch/authHeaders to
 * adminApi.
 */
export default function AdminEmailPage() {
  const confirm = useConfirm();
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [inbox, setInbox] = useState<InboxMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [replyTarget, setReplyTarget] = useState<InboxMessage | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  function loadAccounts() {
    adminApi
      .get<LinkedAccount[]>("/admin/email/accounts")
      .then(setAccounts)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load linked accounts."));
  }

  function loadInbox() {
    adminApi
      .get<InboxMessage[]>("/admin/email/inbox")
      .then(setInbox)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load the inbox."));
  }

  useEffect(() => {
    loadAccounts();
    loadInbox();
  }, []);

  async function handleLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLinking(true);
    const form = new FormData(e.currentTarget);
    try {
      await adminApi.post("/admin/email/accounts", {
        emailAddress: form.get("emailAddress"),
        displayName: form.get("displayName") || undefined,
        imapHost: form.get("imapHost"),
        imapPort: Number(form.get("imapPort")),
        imapUseTls: form.get("imapUseTls") === "on",
        imapUsername: form.get("imapUsername"),
        imapPassword: form.get("imapPassword"),
        smtpHost: form.get("smtpHost"),
        smtpPort: Number(form.get("smtpPort")),
        smtpUseTls: form.get("smtpUseTls") === "on",
        smtpUsername: form.get("smtpUsername"),
        smtpPassword: form.get("smtpPassword"),
      });
      (e.target as HTMLFormElement).reset();
      loadAccounts();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't link that account.");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(id: string, emailAddress: string) {
    const ok = await confirm({
      title: `Unlink ${emailAddress}?`,
      description:
        "This removes the account from UZEYN's unified inbox. Nothing on the mail server itself is affected, but it can only be reached from here again by re-linking it (and re-entering the IMAP/SMTP credentials).",
      confirmLabel: "Unlink",
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    try {
      await adminApi.delete(`/admin/email/accounts/${id}`);
      loadAccounts();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't unlink that account.");
    }
  }

  async function handleTestConnection(id: string) {
    setTestResult((prev) => ({ ...prev, [id]: "Testing..." }));
    try {
      const result = await adminApi.post<{ imapOk: boolean; smtpOk: boolean; error?: string }>(`/admin/email/accounts/${id}/test-connection`);
      setTestResult((prev) => ({
        ...prev,
        [id]: `IMAP: ${result.imapOk ? "OK" : "failed"}, SMTP: ${result.smtpOk ? "OK" : "failed"}${result.error ? ` (${result.error})` : ""}`,
      }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [id]: err instanceof AdminApiError ? err.message : "Test failed." }));
    }
  }

  function openReply(m: InboxMessage) {
    setReplyTarget(m);
    setReplySubject(`Re: ${m.subject}`);
    setReplyBody("");
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTarget) return;
    setError(null);
    try {
      await adminApi.post("/admin/email/reply", {
        accountId: replyTarget.accountId,
        to: replyTarget.from,
        subject: replySubject,
        body: replyBody,
        inReplyTo: replyTarget.uid ? String(replyTarget.uid) : undefined,
      });
      setReplyTarget(null);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't send that reply.");
    }
  }

  if (error && !accounts && !inbox) return <Alert tone="danger">{error}</Alert>;
  if (!accounts || !inbox) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        title="Email"
        description="UZEYN's own unified inbox - link SMTP+IMAP accounts and read/reply from here. No AI summarization or suggested replies in v1.0 (roadmap-only note, SRS §5.22)."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-4xl space-y-4">
        <DashCard>
          <DashCardHeader title="Linked accounts" />
          {accounts.length === 0 ? (
            <p className="text-sm text-ink-muted">No accounts linked yet.</p>
          ) : (
            <Reveal className="divide-y divide-border" stagger={0.04}>
              {accounts.map((a) => (
                <div key={a.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{a.displayName ? `${a.displayName} <${a.emailAddress}>` : a.emailAddress}</p>
                      <p className="text-xs text-ink-muted">
                        IMAP {a.imapHost}:{a.imapPort} · SMTP {a.smtpHost}:{a.smtpPort} · linked {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleTestConnection(a.id)}>
                        Test connection
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleUnlink(a.id, a.emailAddress)}>
                        Unlink
                      </Button>
                    </div>
                  </div>
                  {testResult[a.id] && <p className="text-xs text-ink-muted">{testResult[a.id]}</p>}
                </div>
              ))}
            </Reveal>
          )}
        </DashCard>

        <DashCard>
          <DashCardHeader title="Link a new account" />
          <form onSubmit={handleLink} className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1">
                <Field label="Email address">
                  <Input name="emailAddress" type="email" required />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Display name (optional)">
                  <Input name="displayName" />
                </Field>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field label="IMAP host">
                  <Input name="imapHost" required />
                </Field>
              </div>
              <div className="sm:w-28">
                <Field label="Port">
                  <Input name="imapPort" type="number" required defaultValue={993} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink sm:mb-2.5">
                <input type="checkbox" name="imapUseTls" defaultChecked className="h-4 w-4 rounded border-border-strong" /> use TLS
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1">
                <Field label="IMAP username">
                  <Input name="imapUsername" required />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="IMAP password">
                  <Input name="imapPassword" type="password" required />
                </Field>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field label="SMTP host">
                  <Input name="smtpHost" required />
                </Field>
              </div>
              <div className="sm:w-28">
                <Field label="Port">
                  <Input name="smtpPort" type="number" required defaultValue={587} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink sm:mb-2.5">
                <input type="checkbox" name="smtpUseTls" className="h-4 w-4 rounded border-border-strong" /> use TLS
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1">
                <Field label="SMTP username">
                  <Input name="smtpUsername" required />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="SMTP password">
                  <Input name="smtpPassword" type="password" required />
                </Field>
              </div>
            </div>
            <Button type="submit" disabled={linking}>
              {linking ? "Linking..." : "Link account"}
            </Button>
          </form>
        </DashCard>

        <DashCard>
          <DashCardHeader title="Unified inbox" />
          {inbox.length === 0 ? (
            <p className="text-sm text-ink-muted">No messages yet.</p>
          ) : (
            <Reveal className="divide-y divide-border" stagger={0.04}>
              {inbox.map((m) => (
                <div key={`${m.accountId}-${m.uid}`} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{m.subject}</p>
                    <p className="text-xs text-ink-muted">
                      {m.from} &rarr; {m.accountEmailAddress} {m.date && `· ${new Date(m.date).toLocaleString()}`}
                    </p>
                    <p className="text-sm text-ink-muted">{m.snippet}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openReply(m)}>
                    Reply
                  </Button>
                </div>
              ))}
            </Reveal>
          )}
        </DashCard>

        {replyTarget && (
          <DashCard>
            <DashCardHeader title={`Reply from ${replyTarget.accountEmailAddress} to ${replyTarget.from}`} />
            <form onSubmit={handleReply} className="space-y-3">
              <p className="text-xs text-ink-muted">To: {replyTarget.from} (fixed - replies always go back to the message&apos;s sender)</p>
              <Field label="Subject">
                <Input value={replySubject} onChange={(e) => setReplySubject(e.target.value)} required />
              </Field>
              <Field label="Body">
                <Textarea rows={6} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} required />
              </Field>
              <div className="flex gap-2">
                <Button type="submit">Send reply</Button>
                <Button type="button" variant="ghost" onClick={() => setReplyTarget(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DashCard>
        )}
      </div>
    </div>
  );
}
