"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui/DashCard";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { Reveal } from "@/components/motion/Reveal";

type Channel = "banner" | "popup" | "in_app_notification";
type TargetType = "all" | "plan" | "seller";

const CHANNEL_LABEL: Record<Channel, string> = { banner: "Banner", popup: "Popup", in_app_notification: "In-app notification" };

interface PlatformMessage {
  id: string;
  channel: Channel;
  targetType: TargetType;
  targetPlanId: string | null;
  targetSellerId: string | null;
  title: string | null;
  body: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

/**
 * Phase 6g (Admin Terminal re-skin) - SRS FR-8.15 (extends FR-8.7)'s
 * in-app messaging (banner/popup/in-app-notification, targeted and
 * scheduled), restyled onto DashCard. Every action preserved: list,
 * create, delete (confirm-gated). Converted from hand-rolled fetch/
 * authHeaders to adminApi.
 */
export default function AdminMessagesPage() {
  const confirm = useConfirm();
  const [messages, setMessages] = useState<PlatformMessage[] | null>(null);
  const [channel, setChannel] = useState<Channel>("banner");
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetPlanId, setTargetPlanId] = useState("");
  const [targetSellerId, setTargetSellerId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    adminApi
      .get<PlatformMessage[]>("/admin/messages")
      .then(setMessages)
      .catch(() => setMessages([]));
  }

  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi.post("/admin/messages", {
        channel,
        targetType,
        targetPlanId: targetType === "plan" ? targetPlanId : undefined,
        targetSellerId: targetType === "seller" ? targetSellerId : undefined,
        title: title || undefined,
        body,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
      });
      setTitle("");
      setBody("");
      setStartsAt("");
      setEndsAt("");
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Couldn't create that message.");
    }
  }

  async function remove(message: PlatformMessage) {
    const ok = await confirm({
      title: `Delete this ${message.channel.replace("_", " ")}?`,
      description: message.title ? `"${message.title}" - ${message.body}` : message.body,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await adminApi.delete(`/admin/messages/${message.id}`);
    load();
  }

  if (!messages) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Messages" description="Banners, popups, and in-app notifications shown to sellers - targeted and scheduled." />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="max-w-3xl space-y-4">
        <DashCard className="divide-y divide-border">
          {messages.length === 0 ? (
            <p className="py-3 text-sm text-ink-muted">No messages yet.</p>
          ) : (
            <Reveal stagger={0.04}>
            {messages.map((m) => (
              <div key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {CHANNEL_LABEL[m.channel]}
                    <span className="font-normal text-ink-muted">
                      {" "}
                      · {m.targetType === "all" ? "all sellers" : m.targetType === "plan" ? `plan ${m.targetPlanId}` : `seller ${m.targetSellerId}`}
                    </span>
                  </p>
                  {m.title && <p className="text-sm font-medium text-ink">{m.title}</p>}
                  <p className="text-sm text-ink-muted">{m.body}</p>
                  <p className="text-xs text-ink-faint">
                    {m.startsAt ? new Date(m.startsAt).toLocaleString() : "always"} &rarr; {m.endsAt ? new Date(m.endsAt).toLocaleString() : "forever"}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(m)}>
                  Delete
                </Button>
              </div>
            ))}
            </Reveal>
          )}
        </DashCard>

        <DashCard>
          <DashCardHeader title="New message" />
          <form onSubmit={create} className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="sm:w-56">
                <Field label="Channel">
                  <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                    <option value="banner">Banner</option>
                    <option value="popup">Popup</option>
                    <option value="in_app_notification">In-app notification</option>
                  </Select>
                </Field>
              </div>
              <div className="sm:w-56">
                <Field label="Target">
                  <Select value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)}>
                    <option value="all">All sellers</option>
                    <option value="plan">A specific plan</option>
                    <option value="seller">A specific seller</option>
                  </Select>
                </Field>
              </div>
              {targetType === "plan" && (
                <div className="flex-1">
                  <Field label="Plan ID">
                    <Input value={targetPlanId} onChange={(e) => setTargetPlanId(e.target.value)} required />
                  </Field>
                </div>
              )}
              {targetType === "seller" && (
                <div className="flex-1">
                  <Field label="Seller ID">
                    <Input value={targetSellerId} onChange={(e) => setTargetSellerId(e.target.value)} required />
                  </Field>
                </div>
              )}
            </div>
            <Field label="Title (optional)">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Body">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} required />
            </Field>
            <div className="flex flex-wrap gap-3">
              <div className="w-56">
                <Field label="Starts at (optional)">
                  <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </Field>
              </div>
              <div className="w-56">
                <Field label="Ends at (optional)">
                  <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </Field>
              </div>
            </div>
            <Button type="submit">Create message</Button>
          </form>
        </DashCard>
      </div>
    </div>
  );
}
