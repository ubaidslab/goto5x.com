"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminApiError } from "@/lib/admin-api";

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
 * Module 36 (SRS §5.53/FR-53.1-53.5) - UZEYN's own unified inbox in the
 * admin terminal. Bare functional view (no design pass yet), same
 * discipline as every other admin page.
 */
export default function AdminEmailPage() {
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [inbox, setInbox] = useState<InboxMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [replyTarget, setReplyTarget] = useState<InboxMessage | null>(null);
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

  async function handleUnlink(id: string) {
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
      const result = await adminApi.post<{ imapOk: boolean; smtpOk: boolean; error?: string }>(
        `/admin/email/accounts/${id}/test-connection`,
      );
      setTestResult((prev) => ({
        ...prev,
        [id]: `IMAP: ${result.imapOk ? "OK" : "failed"}, SMTP: ${result.smtpOk ? "OK" : "failed"}${result.error ? ` (${result.error})` : ""}`,
      }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [id]: err instanceof AdminApiError ? err.message : "Test failed." }));
    }
  }

  async function handleReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!replyTarget) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await adminApi.post("/admin/email/reply", {
        accountId: replyTarget.accountId,
        to: form.get("to"),
        subject: form.get("subject"),
        body: form.get("body"),
        inReplyTo: replyTarget.uid ? String(replyTarget.uid) : undefined,
      });
      setReplyTarget(null);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't send that reply.");
    }
  }

  if (error) return <main>{error}</main>;
  if (!accounts || !inbox) return <main>Loading...</main>;

  return (
    <main>
      <h1>Email (bare view - no design pass yet)</h1>
      <p>
        UZEYN&apos;s own unified inbox - link SMTP+IMAP accounts and read/reply from here. No AI summarization or
        suggested replies in v1.0 (roadmap-only note, SRS §5.22).
      </p>

      <h2>Linked accounts</h2>
      {accounts.length === 0 ? (
        <p>No accounts linked yet.</p>
      ) : (
        <table border={1} cellPadding={4}>
          <thead>
            <tr>
              <th>Email</th>
              <th>IMAP</th>
              <th>SMTP</th>
              <th>Linked</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.displayName ? `${a.displayName} <${a.emailAddress}>` : a.emailAddress}</td>
                <td>
                  {a.imapHost}:{a.imapPort}
                </td>
                <td>
                  {a.smtpHost}:{a.smtpPort}
                </td>
                <td>{new Date(a.createdAt).toLocaleString()}</td>
                <td>
                  <button onClick={() => handleTestConnection(a.id)}>Test connection</button>{" "}
                  <button onClick={() => handleUnlink(a.id)}>Unlink</button>
                  {testResult[a.id] && <div>{testResult[a.id]}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Link a new account</h3>
      <form onSubmit={handleLink}>
        <p>
          <label>
            Email address: <input name="emailAddress" type="email" required />
          </label>
        </p>
        <p>
          <label>
            Display name (optional): <input name="displayName" />
          </label>
        </p>
        <p>
          <label>
            IMAP host: <input name="imapHost" required />
          </label>{" "}
          <label>
            port: <input name="imapPort" type="number" required defaultValue={993} />
          </label>{" "}
          <label>
            <input name="imapUseTls" type="checkbox" defaultChecked /> use TLS
          </label>
        </p>
        <p>
          <label>
            IMAP username: <input name="imapUsername" required />
          </label>{" "}
          <label>
            password: <input name="imapPassword" type="password" required />
          </label>
        </p>
        <p>
          <label>
            SMTP host: <input name="smtpHost" required />
          </label>{" "}
          <label>
            port: <input name="smtpPort" type="number" required defaultValue={587} />
          </label>{" "}
          <label>
            <input name="smtpUseTls" type="checkbox" /> use TLS
          </label>
        </p>
        <p>
          <label>
            SMTP username: <input name="smtpUsername" required />
          </label>{" "}
          <label>
            password: <input name="smtpPassword" type="password" required />
          </label>
        </p>
        <button type="submit" disabled={linking}>
          {linking ? "Linking..." : "Link account"}
        </button>
      </form>

      <h2>Unified inbox</h2>
      {inbox.length === 0 ? (
        <p>No messages yet.</p>
      ) : (
        <table border={1} cellPadding={4}>
          <thead>
            <tr>
              <th>Account</th>
              <th>From</th>
              <th>Subject</th>
              <th>Date</th>
              <th>Preview</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inbox.map((m) => (
              <tr key={`${m.accountId}-${m.uid}`}>
                <td>{m.accountEmailAddress}</td>
                <td>{m.from}</td>
                <td>{m.subject}</td>
                <td>{m.date ? new Date(m.date).toLocaleString() : "-"}</td>
                <td>{m.snippet}</td>
                <td>
                  <button onClick={() => setReplyTarget(m)}>Reply</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {replyTarget && (
        <>
          <h3>
            Reply from {replyTarget.accountEmailAddress} to {replyTarget.from}
          </h3>
          <form onSubmit={handleReply}>
            <input type="hidden" name="to" value={replyTarget.from} />
            <p>
              To: {replyTarget.from} (fixed - replies always go back to the message&apos;s sender)
            </p>
            <p>
              <label>
                Subject: <input name="subject" required defaultValue={`Re: ${replyTarget.subject}`} />
              </label>
            </p>
            <p>
              <textarea name="body" rows={6} cols={60} required />
            </p>
            <button type="submit">Send reply</button>{" "}
            <button type="button" onClick={() => setReplyTarget(null)}>
              Cancel
            </button>
          </form>
        </>
      )}
    </main>
  );
}
