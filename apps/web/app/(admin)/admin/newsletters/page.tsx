"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";

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

/**
 * Module 55 (SRS §5.62/FR-62.2) - the admin-composed platform newsletter.
 * Bare functional view (no design pass yet), same discipline as every
 * other admin page.
 */
export default function AdminNewslettersPage() {
  const confirm = useConfirm();
  const [newsletters, setNewsletters] = useState<Newsletter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  function load() {
    adminApi
      .get<Newsletter[]>("/admin/newsletters")
      .then(setNewsletters)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "Couldn't load newsletters."));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const form = new FormData(e.currentTarget);
    try {
      await adminApi.post("/admin/newsletters", {
        subject: form.get("subject"),
        body: form.get("body"),
      });
      (e.target as HTMLFormElement).reset();
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

  if (error) return <main>{error}</main>;
  if (!newsletters) return <main>Loading...</main>;

  return (
    <main>
      <h1>Newsletters (bare view - no design pass yet)</h1>
      <p>
        Compose and send a one-off email to every seller who hasn&apos;t opted out (SRS §5.62/FR-62.2). Sent from
        UZEYN&apos;s own SMTP identity, not a seller&apos;s connected mailbox. Opt-out is re-checked live at send
        time, not at creation - a seller who unsubscribes after you draft this still won&apos;t receive it.
      </p>

      <h2>Compose a new newsletter</h2>
      <form onSubmit={handleCreate}>
        <p>
          <label>
            Subject: <input name="subject" required maxLength={200} size={60} />
          </label>
        </p>
        <p>
          <textarea name="body" rows={8} cols={70} required placeholder="Plain text body." />
        </p>
        <button type="submit" disabled={creating}>
          {creating ? "Saving..." : "Save as draft"}
        </button>
      </form>

      <h2>Past &amp; draft newsletters</h2>
      {newsletters.length === 0 ? (
        <p>No newsletters yet.</p>
      ) : (
        <table border={1} cellPadding={4}>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
              <th>Recipients</th>
              <th>Sent</th>
              <th>Failed</th>
              <th>Created</th>
              <th>Sent at</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {newsletters.map((n) => (
              <tr key={n.id}>
                <td>{n.subject}</td>
                <td>
                  {n.status}
                  {n.status === "failed" && n.failureReason ? ` (${n.failureReason})` : ""}
                </td>
                <td>{n.recipientCount}</td>
                <td>{n.sentCount}</td>
                <td>{n.failedCount}</td>
                <td>{new Date(n.createdAt).toLocaleString()}</td>
                <td>{n.sentAt ? new Date(n.sentAt).toLocaleString() : "-"}</td>
                <td>
                  {n.status === "draft" && (
                    <button onClick={() => handleSend(n.id, n.subject, n.recipientCount)} disabled={sendingId === n.id}>
                      {sendingId === n.id ? "Sending..." : "Send"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
