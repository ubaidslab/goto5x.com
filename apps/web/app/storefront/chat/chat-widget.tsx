"use client";

import { useEffect, useRef, useState } from "react";
import { ResolvedThemeSettings } from "../../../lib/theme-presets";
import { ChatMessage, getChatMessagesAction, postChatMessageAction, startChatAction } from "./actions";

const POLL_MS = 5000;

function keyFor(hostname: string): string {
  return `uzeyn_chat_${hostname}`;
}

function readSession(hostname: string): { threadId: string; accessToken: string } | null {
  try {
    const raw = window.localStorage.getItem(keyFor(hostname));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * FR-66.3 (Module 83) - live chat widget, a distinct surface from
 * WhatsappButton (bottom-left here vs. bottom-right there, its own
 * visual identity) - only ever rendered when the store's plan includes
 * it (StorefrontService.getStorePublic()'s `chatEnabled`, resolved
 * server-side). No buyer-account requirement - a guest can chat too.
 */
export function ChatWidget({ theme, enabled }: { theme: ResolvedThemeSettings; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sellerAway, setSellerAway] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = readSession(window.location.host);
    if (session) setAccessToken(session.accessToken);
  }, []);

  useEffect(() => {
    if (!open || !accessToken) return;
    let cancelled = false;
    async function poll() {
      const result = await getChatMessagesAction(accessToken!);
      if (!cancelled && result.ok) {
        setMessages(result.messages);
        setSellerAway(result.sellerAway);
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, accessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!enabled) return null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    const hostname = window.location.host;
    if (!accessToken) {
      const started = await startChatAction(hostname, draft.trim());
      setSending(false);
      if (!started.ok) return;
      window.localStorage.setItem(keyFor(hostname), JSON.stringify({ threadId: started.threadId, accessToken: started.accessToken }));
      setAccessToken(started.accessToken);
      setDraft("");
      return;
    }
    const result = await postChatMessageAction(accessToken, draft.trim());
    setSending(false);
    if (result.ok) {
      setMessages(result.messages);
      setSellerAway(result.sellerAway);
      setDraft("");
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 24, left: 24, zIndex: 50 }}>
      {open && (
        <div
          style={{
            width: 320,
            height: 420,
            marginBottom: 12,
            background: theme.colors.background,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", fontWeight: 600, color: theme.colors.text }}>
            Chat with us
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 13, color: "#6b7280" }}>Send a message and the seller will reply here.</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.authorType === "buyer" ? "flex-end" : "flex-start",
                  background: m.authorType === "buyer" ? theme.colors.primary : "#f3f4f6",
                  color: m.authorType === "buyer" ? "#fff" : theme.colors.text,
                  padding: "6px 10px",
                  borderRadius: 10,
                  maxWidth: "80%",
                  fontSize: 13,
                }}
              >
                {m.body}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {sellerAway && (
            <div style={{ padding: "6px 14px", fontSize: 12, color: "#92400e", background: "#fef3c7" }}>
              The seller is away right now - they'll reply as soon as they're back.
            </div>
          )}
          <form onSubmit={send} style={{ display: "flex", borderTop: "1px solid #e5e7eb" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message..."
              style={{ flex: 1, border: "none", padding: "10px 12px", outline: "none" }}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              style={{ border: "none", background: theme.colors.primary, color: "#fff", padding: "0 16px", cursor: "pointer" }}
            >
              Send
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Open live chat"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: theme.colors.primary,
          color: "#fff",
          fontSize: 22,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        {open ? "×" : "🗨"}
      </button>
    </div>
  );
}
