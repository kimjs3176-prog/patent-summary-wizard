import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatStatus } from "ai";
import { BarChart3, FileSearch, Handshake, RotateCcw } from "lucide-react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import chatMark from "@/assets/patent-chat-mark.png";
import {
  applyEvent, clearConversation, loadConversation, saveConversation, streamChat, SUGGESTED_QUESTIONS, visibleCards,
  type ChatMessage, type ChatPatentCard,
} from "@/lib/patentChat";

const TOOL_ICONS: Record<string, typeof FileSearch> = { search: FileSearch, trends: BarChart3, transfer: Handshake };

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function toolSummary(toolName: string, output: unknown): string {
  const o = (output ?? {}) as { total?: number; cards?: unknown[]; field?: string; completeYear?: number; steps?: number };
  if (toolName === "search") {
    const shown = o.cards?.length ?? 0;
    return `${o.field ? `${o.field} 분야에서 ` : ""}특허 ${o.total ?? 0}건을 찾아 ${shown}건을 골랐습니다.`;
  }
  if (toolName === "trends") return `${o.completeYear ?? ""}년까지 공개된 출원 통계를 확인했습니다.`;
  if (toolName === "transfer") return `기술이전 ${o.steps ?? 6}단계 안내를 확인했습니다.`;
  return "확인했습니다.";
}

function PatentCards({ cards, onOpen }: { cards: ChatPatentCard[]; onOpen: (id: string) => void }) {
  if (!cards.length) return null;
  return (
    <ul className="patent-chat-cards mt-1 grid gap-2">
      {cards.map((c) => (
        <li key={c.patentId} className="patent-chat-card rounded-xl border bg-card p-3">
          <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{c.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {c.applicant && <span>{c.applicant}</span>}
            {c.applicationDate && <span>출원 {c.applicationDate}</span>}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            {c.trl !== null && c.totalScore !== null ? (
              <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                <span className="patent-chat-score rounded-md px-2 py-0.5">TRL {c.trl}</span>
                <span className="patent-chat-score rounded-md px-2 py-0.5">사업화 {c.totalScore}점</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">아직 분석 전</span>
            )}
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs font-semibold" onClick={() => onOpen(c.patentId)}>
              AI 요약 보기
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function PatentChat({ onOpenPatent }: { onOpenPatent: (patentId: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadConversation());
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const focusComposer = useCallback(() => {
    composerRef.current?.querySelector("textarea")?.focus();
  }, []);

  useEffect(() => { focusComposer(); }, [focusComposer]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = status === "submitted" || status === "streaming";

  const send = useCallback(async (raw: string) => {
    const text = raw.trim().slice(0, 1000);
    if (!text || busy) return;
    setError(null);
    const user: ChatMessage = { id: newId(), role: "user", parts: [{ type: "text", text }] };
    const assistantId = newId();
    let assistant: ChatMessage = { id: assistantId, role: "assistant", parts: [] };
    const base = [...messages, user];
    setMessages([...base, assistant]);
    setStatus("submitted");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let failed: string | null = null;
    try {
      await streamChat(base, (event) => {
        if (event.type === "error") { failed = event.message; return; }
        if (event.type === "text-delta") setStatus("streaming");
        assistant = applyEvent(assistant, event);
        setMessages([...base, assistant]);
      }, ctrl.signal);
    } catch (e) {
      if (!ctrl.signal.aborted) failed = e instanceof Error ? e.message : "답변을 받지 못했습니다.";
    }
    const hasContent = assistant.parts.some((p) => p.type === "text" && p.text.trim());
    const finalMessages = hasContent ? [...base, assistant] : base;
    setMessages(finalMessages);
    saveConversation(finalMessages);
    setError(failed && !hasContent ? failed : null);
    setStatus(failed && !hasContent ? "error" : "ready");
    abortRef.current = null;
    focusComposer();
  }, [busy, messages, focusComposer]);

  const handleSubmit = (message: PromptInputMessage) => { void send(message.text ?? ""); };
  const stop = () => abortRef.current?.abort();
  const reset = () => {
    abortRef.current?.abort();
    clearConversation();
    setMessages([]);
    setError(null);
    setStatus("ready");
    focusComposer();
  };

  return (
    <div className="patent-chat flex flex-col">
      <div className="flex items-center justify-between gap-3 px-2.5 pt-2 pb-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src={chatMark} alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">농업특허 상담</p>
            <p className="truncate text-xs text-muted-foreground">6개 농업기관 특허와 출원 통계로만 답해 드려요</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={reset} className="h-8 shrink-0 gap-1 rounded-lg text-xs text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> 새 대화
          </Button>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-1.5 px-2.5 pb-2.5 pt-1">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void send(q)}
              className="patent-chat-suggestion rounded-full border px-3 py-1.5 text-xs font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {q}
            </button>
          ))}
        </div>
      ) : (
        <Conversation className="patent-chat-log h-[min(58vh,520px)] flex-none border-t">
          <ConversationContent className="gap-5 px-2.5 py-4">
            {messages.map((m, idx) => {
              const isLast = idx === messages.length - 1;
              if (m.role === "user") {
                return (
                  <Message key={m.id} from="user">
                    <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                      {m.parts.map((p, i) => (p.type === "text" ? <span key={i} className="whitespace-pre-wrap">{p.text}</span> : null))}
                    </MessageContent>
                  </Message>
                );
              }
              const hasText = m.parts.some((p) => p.type === "text" && p.text);
              return (
                <Message key={m.id} from="assistant" className="max-w-full">
                  <MessageContent className="w-full overflow-visible">
                    {m.parts.map((p, i) => {
                      if (p.type === "dynamic-tool") {
                        const Icon = TOOL_ICONS[p.toolName] ?? FileSearch;
                        return (
                          <Tool key={p.toolCallId} defaultOpen={false} className="mb-0 rounded-lg">
                            <ToolHeader type="dynamic-tool" toolName={p.toolName} title={p.title} state={p.state} icon={<Icon className="size-4 text-primary" aria-hidden="true" />} className="p-2.5" />
                            <ToolContent className="space-y-3 p-3 pt-0">
                              <p className="text-xs text-muted-foreground">
                                {p.state === "output-available" ? toolSummary(p.toolName, p.output) : p.state === "output-error" ? p.errorText : "자료를 확인하고 있습니다."}
                              </p>
                              <ToolInput input={p.input} />
                              {p.state === "output-error" && <ToolOutput output={undefined} errorText={p.errorText} />}
                            </ToolContent>
                          </Tool>
                        );
                      }
                      if (p.type === "text") {
                        return <MessageResponse key={i} isAnimating={isLast && status === "streaming"}>{p.text}</MessageResponse>;
                      }
                      return null;
                    })}
                    {isLast && busy && !hasText && <Shimmer className="text-sm">특허와 통계를 찾아보는 중…</Shimmer>}
                    {(!isLast || !busy) && <PatentCards cards={visibleCards(m)} onOpen={onOpenPatent} />}
                  </MessageContent>
                </Message>
              );
            })}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div ref={composerRef} className="px-1 pb-1">
        <PromptInput onSubmit={handleSubmit} className="patent-chat-composer">
          <PromptInputTextarea
            aria-label="질문 입력"
            maxLength={1000}
            placeholder="예: 요새 활용하면 좋은 기술 있을까?"
            className="min-h-12 text-[15px]"
          />
          <PromptInputFooter className="justify-between">
            <span className="px-1 text-[11px] text-muted-foreground">실제 특허·통계에 없는 내용은 답하지 않습니다</span>
            <PromptInputSubmit status={status === "error" ? "ready" : status} onStop={stop} aria-label={busy ? "답변 중지" : "질문 보내기"} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
