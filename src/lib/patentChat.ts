// Client side of the conversational patent assistant (홈 '물어보기' 탭).
// One conversation, kept only in this browser (localStorage).
import type { DynamicToolUIPart, UIMessage } from "ai";

export type ChatMessage = UIMessage;

export interface ChatPatentCard {
  patentId: string;
  title: string;
  applicant: string;
  applicationDate: string;
  snippet: string;
  trl: number | null;
}

export const STORAGE_KEY = "ais-patent-chat-v1";
const MAX_STORED = 40;

export const SUGGESTED_QUESTIONS = [
  "요새 활용하면 좋은 기술 있을까?",
  "최근 출원이 늘어난 분야는 어디야?",
  "딸기 저장기간을 늘리는 기술 추천해줘",
  "기술이전은 어떻게 받나요?",
];

export function loadConversation(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((m) => m && typeof m.id === "string" && Array.isArray(m.parts)) : [];
  } catch {
    return [];
  }
}

export function saveConversation(messages: ChatMessage[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  } catch { /* storage full or disabled — keep the in-memory conversation */ }
}

export function clearConversation() {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export const messageText = (m: ChatMessage) =>
  m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();

export function cardsOf(m: ChatMessage): ChatPatentCard[] {
  const cards: ChatPatentCard[] = [];
  for (const p of m.parts) {
    if (p.type !== "dynamic-tool" || p.state !== "output-available") continue;
    const out = p.output as { cards?: ChatPatentCard[] } | undefined;
    if (Array.isArray(out?.cards)) cards.push(...out.cards);
  }
  return cards;
}

const squash = (t: string) => t.replace(/[^0-9A-Za-z가-힣]/g, "").toLowerCase();

/**
 * Cards to show under an answer: retrieved patents the answer actually talks about, in the order it mentions them.
 * When the answer names none of them (e.g. an empty or generic reply), every retrieved card is shown.
 */
export function visibleCards(m: ChatMessage): ChatPatentCard[] {
  const cards = cardsOf(m);
  const text = squash(messageText(m));
  if (!text) return cards;
  const mentioned = cards
    .map((c) => {
      const key = squash(c.title);
      const probe = key.slice(0, Math.min(key.length, 12));
      return { c, at: probe.length >= 4 ? text.indexOf(probe) : -1 };
    })
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.c);
  return mentioned.length ? mentioned : cards;
}

/** Plain-text history for the server; assistant turns carry the patents they showed so follow-ups can refer to them. */
export function toRequestMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      let content = messageText(m);
      const cards = m.role === "assistant" ? visibleCards(m) : [];
      if (cards.length) {
        content += `\n[이 답변에서 보여준 특허: ${cards.map((c, i) => `${i + 1}) ${c.title} (TRL ${c.trl ?? "미분석"})`).join("; ")}]`;
      }
      return { role: m.role as "user" | "assistant", content: content.slice(0, 3000) };
    })
    .filter((m) => m.content.length > 0)
    .slice(-10);
}

type ServerEvent =
  | { type: "tool-start"; id: string; toolName: string; title: string; input: unknown }
  | { type: "tool-result"; id: string; output: unknown }
  | { type: "tool-error"; id: string; errorText: string }
  | { type: "text-delta"; delta: string }
  | { type: "error"; message: string }
  | { type: "done" };

/** Apply one server event to the assistant message (returns a new message object). */
export function applyEvent(message: ChatMessage, event: ServerEvent): ChatMessage {
  const parts = [...message.parts];
  switch (event.type) {
    case "tool-start":
      parts.push({ type: "dynamic-tool", toolName: event.toolName, toolCallId: event.id, title: event.title, state: "input-available", input: event.input });
      break;
    case "tool-result":
    case "tool-error": {
      const idx = parts.findIndex((p) => p.type === "dynamic-tool" && p.toolCallId === event.id);
      if (idx < 0) break;
      const prev = parts[idx] as DynamicToolUIPart;
      parts[idx] = event.type === "tool-result"
        ? { type: "dynamic-tool", toolName: prev.toolName, toolCallId: prev.toolCallId, title: prev.title, state: "output-available", input: prev.input, output: event.output }
        : { type: "dynamic-tool", toolName: prev.toolName, toolCallId: prev.toolCallId, title: prev.title, state: "output-error", input: prev.input, errorText: event.errorText };
      break;
    }
    case "text-delta": {
      const last = parts[parts.length - 1];
      if (last?.type === "text") parts[parts.length - 1] = { ...last, text: last.text + event.delta };
      else parts.push({ type: "text", text: event.delta });
      break;
    }
    default:
      return message;
  }
  return { ...message, parts };
}

export class ChatRequestError extends Error {}

/** POST the conversation and feed each server event to `onEvent` until the stream ends. */
export async function streamChat(messages: ChatMessage[], onEvent: (e: ServerEvent) => void, signal?: AbortSignal) {
  const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/patent-chat`;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ messages: toRequestMessages(messages) }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new ChatRequestError(body?.error || "답변을 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try { onEvent(JSON.parse(line.slice(6)) as ServerEvent); } catch { /* skip malformed frame */ }
    }
  }
}
