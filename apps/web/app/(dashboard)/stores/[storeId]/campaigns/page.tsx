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

type CampaignStatus = "queued" | "sending" | "sent" | "failed";

interface Campaign {
  id: string;
  subject: string;
  status: CampaignStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  failureReason: string | null;
  createdAt: string;
  sentAt: string | null;
  segment: { name: string };
  senderEmail: { emailAddress: string };
}

interface Segment {
  id: string;
  name: string;
  memberCount: number;
}

interface SenderEmail {
  id: string;
  emailAddress: string;
  status: string;
}

const statusTone: Record<CampaignStatus, "neutral" | "success" | "warning" | "danger"> = {
  queued: "neutral",
  sending: "warning",
  sent: "success",
  failed: "danger",
};

export default function CampaignsPage({ params }: { params: { storeId: string } }) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [senders, setSenders] = useState<SenderEmail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    api
      .get<Campaign[]>(`/stores/${params.storeId}/campaigns`)
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }

  useEffect(() => {
    load();
    api
      .get<Segment[]>(`/stores/${params.storeId}/customer-segments`)
      .then(setSegments)
      .catch(() => setSegments([]));
    api
      .get<SenderEmail[]>(`/sellers/me/verification-emails`)
      .then((all) => setSenders(all.filter((s) => s.status === "active")))
      .catch(() => setSenders([]));
  }, [params.storeId]);

  if (!campaigns) return <PageSpinner />;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(`/stores/${params.storeId}/campaigns`, {
        segmentId: form.get("segmentId"),
        senderEmailId: form.get("senderEmailId"),
        subject: form.get("subject"),
        body: form.get("body"),
      });
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that campaign.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Email Campaigns"
        description="Send a basic email campaign to a saved customer segment, through your own connected SMTP sender."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-2xl space-y-6">
        {segments.length === 0 || senders.length === 0 ? (
          <Alert tone="warning">
            {segments.length === 0 && "You need at least one customer segment before you can send a campaign. "}
            {senders.length === 0 &&
              "You need an active connected sender email (Order Verification settings -> Connected sender emails) before you can send a campaign."}
          </Alert>
        ) : null}

        <Card>
          <CardHeader title="New campaign" />
          <CardBody>
            <Alert tone="info" className="mb-4">
              Deliverability depends entirely on your own email provider&apos;s reputation and sending limits - this
              platform does not warm senders or guarantee inbox placement.
            </Alert>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Segment">
                <Select name="segmentId" required disabled={segments.length === 0}>
                  <option value="">Select a segment...</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.memberCount} customers)
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Send from">
                <Select name="senderEmailId" required disabled={senders.length === 0}>
                  <option value="">Select a sender...</option>
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emailAddress}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subject">
                <Input name="subject" maxLength={200} required placeholder="e.g. This week's new arrivals" />
              </Field>
              <Field label="Message">
                <Textarea name="body" rows={8} maxLength={20000} required placeholder="Write your campaign email..." />
              </Field>
              <Button type="submit" loading={creating} disabled={segments.length === 0 || senders.length === 0}>
                Send campaign
              </Button>
            </form>
          </CardBody>
        </Card>

        {campaigns.length === 0 ? (
          <Card>
            <EmptyState title="No campaigns yet" description="Send one above once you have a segment and a connected sender email." />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{campaign.subject}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      To &quot;{campaign.segment.name}&quot; · from {campaign.senderEmail.emailAddress} ·{" "}
                      {new Date(campaign.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-ink-muted">
                      {campaign.sentCount}/{campaign.recipientCount} sent
                      {campaign.failedCount > 0 && `, ${campaign.failedCount} failed`}
                    </span>
                    <Badge tone={statusTone[campaign.status]}>{campaign.status}</Badge>
                  </div>
                </div>
                {campaign.status === "failed" && campaign.failureReason && (
                  <p className="mt-2 text-xs text-danger">{campaign.failureReason}</p>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
