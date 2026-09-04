"use server";

/**
 * FR-66.3 (Module 83) - live chat, same Server-Action-only discipline as
 * checkout/account actions (a tenant's dynamic subdomain/custom domain
 * can never be pre-listed in the API's static CORS allowlist).
 */

export interface ChatMessage {
  id: string;
  authorType: "buyer" | "seller";
  body: string;
  createdAt: string;
}

interface ApiError {
  ok: false;
  error: string;
}

function extractError(body: { message?: string | string[] }, fallback: string): string {
  return typeof body.message === "string" ? body.message : Array.isArray(body.message) ? body.message.join(", ") : fallback;
}

export async function startChatAction(
  hostname: string,
  body: string,
  buyerEmail?: string,
): Promise<{ ok: true; threadId: string; accessToken: string } | ApiError> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hostname, body, buyerEmail: buyerEmail || undefined }),
  });
  const json = await res.json().catch(() => ({}) as { message?: string | string[] });
  if (!res.ok) return { ok: false, error: extractError(json, "Couldn't start the chat - please try again.") };
  return { ok: true, threadId: json.threadId, accessToken: json.accessToken };
}

export async function getChatMessagesAction(
  accessToken: string,
): Promise<{ ok: true; status: string; sellerAway: boolean; messages: ChatMessage[] } | ApiError> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/chat/${accessToken}/messages`, { cache: "no-store" });
  const json = await res.json().catch(() => ({}) as { message?: string | string[] });
  if (!res.ok) return { ok: false, error: extractError(json, "Couldn't load messages.") };
  return { ok: true, status: json.status, sellerAway: json.sellerAway, messages: json.messages };
}

export async function postChatMessageAction(
  accessToken: string,
  body: string,
): Promise<{ ok: true; status: string; sellerAway: boolean; messages: ChatMessage[] } | ApiError> {
  const res = await fetch(`${process.env.API_BASE_URL}/storefront/chat/${accessToken}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  const json = await res.json().catch(() => ({}) as { message?: string | string[] });
  if (!res.ok) return { ok: false, error: extractError(json, "Couldn't send your message - please try again.") };
  return { ok: true, status: json.status, sellerAway: json.sellerAway, messages: json.messages };
}
