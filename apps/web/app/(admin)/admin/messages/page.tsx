"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialogProvider";

type Channel = "banner" | "popup" | "in_app_notification";
type TargetType = "all" | "plan" | "seller";

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
 * SRS FR-8.15 (extends FR-8.7) - in-app messaging across banner/popup/
 * in-app-notification, each targeted and scheduled. Bare view (no design
 * pass yet). Maintenance mode itself (the rest of FR-8.7) is a Settings
 * Registry write via the existing generic /admin/settings endpoint, not a
 * separate screen here.
 */
export default function AdminMessagesPage() {
  const confirm = useConfirm();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [messages, setMessages] = useState<PlatformMessage[]>([]);
  const [channel, setChannel] = useState<Channel>("banner");
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetPlanId, setTargetPlanId] = useState("");
  const [targetSellerId, setTargetSellerId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("adminAccessToken");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  function load() {
    fetch(`${apiBase}/admin/messages`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => setMessages([]));
  }

  useEffect(load, [apiBase]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`${apiBase}/admin/messages`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        channel,
        targetType,
        targetPlanId: targetType === "plan" ? targetPlanId : undefined,
        targetSellerId: targetType === "seller" ? targetSellerId : undefined,
        title: title || undefined,
        body,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
      }),
    });
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      setError(resBody.message ?? "Couldn't create that message.");
      return;
    }
    setTitle("");
    setBody("");
    setStartsAt("");
    setEndsAt("");
    load();
  }

  async function remove(message: PlatformMessage) {
    const ok = await confirm({
      title: `Delete this ${message.channel.replace("_", " ")}?`,
      description: message.title ? `"${message.title}" - ${message.body}` : message.body,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await fetch(`${apiBase}/admin/messages/${message.id}`, { method: "DELETE", headers: authHeaders() });
    load();
  }

  return (
    <main>
      <h1>Messages (bare view - no design pass yet)</h1>
      <p>Banners, popups, and in-app notifications shown to sellers - targeted and scheduled.</p>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Target</th>
            <th>Title</th>
            <th>Body</th>
            <th>Window</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => (
            <tr key={m.id}>
              <td>{m.channel}</td>
              <td>
                {m.targetType}
                {m.targetType === "plan" && ` (${m.targetPlanId})`}
                {m.targetType === "seller" && ` (${m.targetSellerId})`}
              </td>
              <td>{m.title ?? "-"}</td>
              <td>{m.body}</td>
              <td>
                {m.startsAt ?? "always"} &rarr; {m.endsAt ?? "forever"}
              </td>
              <td>
                <button onClick={() => remove(m)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>New message</h2>
      <form onSubmit={create}>
        <p>
          <label>
            Channel{" "}
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              <option value="banner">Banner</option>
              <option value="popup">Popup</option>
              <option value="in_app_notification">In-app notification</option>
            </select>
          </label>
        </p>
        <p>
          <label>
            Target{" "}
            <select value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)}>
              <option value="all">All sellers</option>
              <option value="plan">A specific plan</option>
              <option value="seller">A specific seller</option>
            </select>
          </label>
        </p>
        {targetType === "plan" && (
          <p>
            <label>
              Plan ID <input value={targetPlanId} onChange={(e) => setTargetPlanId(e.target.value)} required />
            </label>
          </p>
        )}
        {targetType === "seller" && (
          <p>
            <label>
              Seller ID <input value={targetSellerId} onChange={(e) => setTargetSellerId(e.target.value)} required />
            </label>
          </p>
        )}
        <p>
          <label>
            Title <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            Body <textarea value={body} onChange={(e) => setBody(e.target.value)} required />
          </label>
        </p>
        <p>
          <label>
            Starts at <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            Ends at <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </p>
        <button type="submit">Create message</button>
      </form>
    </main>
  );
}
