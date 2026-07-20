"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/dashboard-api";

interface PlatformMessage {
  id: string;
  channel: "banner" | "popup" | "in_app_notification";
  title: string | null;
  body: string;
}

/** SRS FR-8.15 - the seller-facing side of admin-authored messaging: banners inline, a popup dismissible per browser session, notifications listed. */
export function PlatformMessages() {
  const [messages, setMessages] = useState<PlatformMessage[]>([]);
  const [dismissedPopups, setDismissedPopups] = useState<string[]>([]);

  useEffect(() => {
    api
      .get<PlatformMessage[]>("/sellers/me/messages")
      .then(setMessages)
      .catch(() => setMessages([]));
  }, []);

  function dismissPopup(id: string) {
    sessionStorage.setItem(`dismissed-popup-${id}`, "1");
    setDismissedPopups([...dismissedPopups, id]);
  }

  const banners = messages.filter((m) => m.channel === "banner");
  const notifications = messages.filter((m) => m.channel === "in_app_notification");
  const popup = messages.find(
    (m) => m.channel === "popup" && !dismissedPopups.includes(m.id) && !sessionStorage.getItem(`dismissed-popup-${m.id}`),
  );

  return (
    <>
      {banners.map((m) => (
        <div key={m.id} className="mb-4 rounded-md bg-info-subtle px-4 py-3 text-sm text-info">
          {m.title && <strong>{m.title}: </strong>}
          {m.body}
        </div>
      ))}

      {notifications.length > 0 && (
        <div className="mb-4 space-y-2">
          {notifications.map((m) => (
            <div key={m.id} className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-ink">
              {m.title && <strong>{m.title}: </strong>}
              {m.body}
            </div>
          ))}
        </div>
      )}

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-lg">
            {popup.title && <h2 className="mb-2 text-base font-semibold text-ink">{popup.title}</h2>}
            <p className="mb-4 text-sm text-ink-muted">{popup.body}</p>
            <button
              className="rounded-md bg-accent px-4 py-2 text-sm text-on-accent"
              onClick={() => dismissPopup(popup.id)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
