"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { toast } from "@/lib/use-toast";
import { api } from "@/lib/dashboard-api";

interface ChatThreadSummary {
  id: string;
  buyerEmail: string | null;
  status: "open" | "closed";
  updatedAt: string;
  lastMessage: { body: string; authorType: "buyer" | "seller" } | null;
}

interface ChatMessage {
  id: string;
  authorType: "buyer" | "seller";
  body: string;
  createdAt: string;
}

/** FR-66.3 (Module 83) - seller-facing live chat inbox: list threads, open one, reply, close. */
export default function BuyerChatPage({ params }: { params: { storeId: string } }) {
  const [threads, setThreads] = useState<ChatThreadSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [status, setStatus] = useState<"open" | "closed" | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  function loadThreads() {
    api.get<ChatThreadSummary[]>(`/stores/${params.storeId}/buyer-chat`).then(setThreads);
  }

  useEffect(loadThreads, [params.storeId]);

  function openThread(id: string) {
    setSelectedId(id);
    api
      .get<{ status: "open" | "closed"; messages: ChatMessage[] }>(`/stores/${params.storeId}/buyer-chat/${id}`)
      .then((t) => {
        setMessages(t.messages);
        setStatus(t.status);
      });
  }

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    try {
      await api.post(`/stores/${params.storeId}/buyer-chat/${selectedId}/reply`, { body: draft.trim() });
      setDraft("");
      openThread(selectedId);
      loadThreads();
    } catch {
      toast({ title: "Couldn't send your reply", tone: "danger" });
    } finally {
      setSending(false);
    }
  }

  async function closeThread() {
    if (!selectedId) return;
    await api.patch(`/stores/${params.storeId}/buyer-chat/${selectedId}/close`);
    setStatus("closed");
    loadThreads();
  }

  if (threads === null) return <PageSpinner />;

  return (
    <div>
      <PageHeader title="Live chat" description="Conversations buyers have started from your storefront's chat widget." />
      {threads.length === 0 ? (
        <EmptyState
          title="No chat conversations yet"
          description="When a buyer starts a chat from your storefront, it will show up here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          <Card className="divide-y divide-border p-0">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`block w-full px-4 py-3 text-left hover:bg-surface-hover ${selectedId === t.id ? "bg-surface-hover" : ""}`}
              >
                <div className="flex items-center justify-between text-sm font-medium text-ink">
                  <span>{t.buyerEmail ?? "Guest"}</span>
                  {t.status === "closed" && <span className="text-xs text-ink-muted">Closed</span>}
                </div>
                {t.lastMessage && (
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {t.lastMessage.authorType === "seller" ? "You: " : ""}
                    {t.lastMessage.body}
                  </p>
                )}
              </button>
            ))}
          </Card>

          <Card className="flex min-h-[420px] flex-col p-0">
            {!selectedId || messages === null ? (
              <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">Select a conversation</div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-medium text-ink">Conversation</span>
                  {status === "open" && (
                    <Button variant="secondary" size="sm" onClick={closeThread}>
                      Close conversation
                    </Button>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        m.authorType === "seller" ? "self-end bg-accent text-white" : "self-start bg-surface-hover text-ink"
                      }`}
                    >
                      {m.body}
                    </div>
                  ))}
                </div>
                {status === "open" && (
                  <form onSubmit={reply} className="flex gap-2 border-t border-border p-3">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Reply to buyer..."
                      className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
                    />
                    <Button type="submit" loading={sending} disabled={!draft.trim()}>
                      Send
                    </Button>
                  </form>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
