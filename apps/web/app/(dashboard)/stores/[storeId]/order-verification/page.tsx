"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/dashboard-api";

type Channel = "none" | "whatsapp_otp" | "email_otp" | "prepaid_confirmation";

interface VerificationSettings {
  channel: Channel;
  messageTemplate: string;
}

interface VerificationEmail {
  id: string;
  emailAddress: string;
  smtpHost: string;
  smtpPort: number;
  status: "active" | "revoked";
  dailySendCount: number;
  connectedAt: string;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  none: "No verification (default)",
  whatsapp_otp: "WhatsApp OTP (manual/link-assisted)",
  email_otp: "Email OTP (your own SMTP account)",
  prepaid_confirmation: "Prepaid confirmation (mark deposit received)",
};

/**
 * SRS §5.37 (Module 26) - bare-functional per the founder's own instruction
 * for this feature ("bare-functional UI, premium redesign comes in the
 * design phase later"). Lets a seller pick their store's order-verification
 * channel, edit the OTP message template, and (for Email OTP) manage their
 * connected sender emails - the counterpart to the backend built earlier
 * in this module.
 */
export default function OrderVerificationPage({ params }: { params: { storeId: string } }) {
  const [settings, setSettings] = useState<VerificationSettings | null>(null);
  const [emails, setEmails] = useState<VerificationEmail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [connecting, setConnecting] = useState(false);

  function load() {
    api.get<VerificationSettings>(`/stores/${params.storeId}/verification-settings`).then(setSettings).catch(() => setSettings(null));
    api.get<VerificationEmail[]>("/sellers/me/verification-emails").then(setEmails).catch(() => setEmails([]));
  }

  useEffect(load, [params.storeId]);

  if (!settings || !emails) return <PageSpinner />;

  async function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavingSettings(true);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.patch<VerificationSettings>(`/stores/${params.storeId}/verification-settings`, {
        channel: form.get("channel") as Channel,
        messageTemplate: form.get("messageTemplate") as string,
      });
      setSettings(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save verification settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function connectEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConnecting(true);
    const form = new FormData(e.currentTarget);
    try {
      await api.post("/sellers/me/verification-emails", {
        emailAddress: form.get("emailAddress") as string,
        smtpHost: form.get("smtpHost") as string,
        smtpPort: Number(form.get("smtpPort")),
        smtpUsername: form.get("smtpUsername") as string,
        smtpPassword: form.get("smtpPassword") as string,
      });
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't connect that sender email.");
    } finally {
      setConnecting(false);
    }
  }

  async function revokeEmail(id: string) {
    try {
      await api.delete(`/sellers/me/verification-emails/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke that sender email.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Order verification"
        description="Confirm real buyers before an order counts as a sale - the free v1.0 anti-fraud layer Shopify doesn't have."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader
            title="Verification channel"
            description="An order placed against this store stays unconfirmed until it clears this channel - the same gate as payment."
          />
          <CardBody>
            <form onSubmit={saveSettings} className="space-y-4">
              <Field label="Channel" hint="Applies to every new order placed from now on.">
                <Select name="channel" defaultValue={settings.channel} required>
                  {(Object.keys(CHANNEL_LABEL) as Channel[]).map((channel) => (
                    <option key={channel} value={channel}>
                      {CHANNEL_LABEL[channel]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="OTP message template"
                hint="Only used for WhatsApp OTP and Email OTP. {{otp}} is replaced with the buyer's code."
              >
                <Textarea name="messageTemplate" rows={3} defaultValue={settings.messageTemplate} maxLength={1000} />
              </Field>
              <Button type="submit" loading={savingSettings}>
                Save
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Connected sender emails"
            description="Required for Email OTP - the code is sent from your own inbox, never this platform's. Up to 5 connected, rotating once one hits its daily cap."
          />
          <CardBody className="space-y-4">
            {emails.length === 0 ? (
              <EmptyState title="No sender emails connected yet" description="Connect one below to use the Email OTP channel." />
            ) : (
              <ul className="divide-y divide-border">
                {emails.map((sender) => (
                  <li key={sender.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{sender.emailAddress}</p>
                      <p className="text-xs text-ink-muted">
                        {sender.smtpHost}:{sender.smtpPort} - {sender.dailySendCount} sent today
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={sender.status === "active" ? "success" : "neutral"}>{sender.status}</Badge>
                      {sender.status === "active" && (
                        <Button type="button" variant="ghost" onClick={() => revokeEmail(sender.id)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={connectEmail} className="space-y-4 border-t border-border pt-4">
              <Field label="Email address">
                <Input name="emailAddress" type="email" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="SMTP host">
                  <Input name="smtpHost" required />
                </Field>
                <Field label="SMTP port">
                  <Input name="smtpPort" type="number" min={1} max={65535} defaultValue={587} required />
                </Field>
              </div>
              <Field label="SMTP username">
                <Input name="smtpUsername" required />
              </Field>
              <Field label="SMTP password / app password" hint="Encrypted at rest, never shown again after saving.">
                <Input name="smtpPassword" type="password" required />
              </Field>
              <Button type="submit" loading={connecting}>
                Connect sender email
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
