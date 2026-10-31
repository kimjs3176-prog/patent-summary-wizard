import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { MessagesSquare } from "lucide-react";
import { PatentInput } from "@/components/PatentInput";
import type { PendingQuestion } from "@/components/PatentChat";
import type { KeywordSearchResult } from "@/components/PatentSummary/types";
import { loadConversation } from "@/lib/patentChat";

// Loaded only when a question is asked so pages stay light.
const PatentChat = lazy(() => import("@/components/PatentChat"));

interface SmartSearchBoxProps {
  onSubmit: (patentNumber: string) => void;
  onKeywordSearch: (results: KeywordSearchResult[], keyword: string) => void;
  isLoading: boolean;
  placeholder?: string;
  skipKeywordFetch?: boolean;
  /** Wraps the input or the conversation (e.g. a card surface). Receives whether the conversation is open. */
  frame?: (content: ReactNode, chatOpen: boolean) => ReactNode;
  resumeClassName?: string;
  /** Positions the "이전 대화 이어서 보기" row (e.g. align it under a centred box). */
  resumeRowClassName?: string;
  /** Lets the surrounding layout adapt (e.g. collapse a hero) while the conversation is open. */
  onChatOpenChange?: (open: boolean) => void;
}

/**
 * One search box for every input style: patent numbers and keywords/sentences search as before,
 * questions (classified in queryIntent) open the patent assistant in place.
 */
export function SmartSearchBox({
  onSubmit, onKeywordSearch, isLoading, placeholder, skipKeywordFetch, frame, resumeClassName, resumeRowClassName, onChatOpenChange,
}: SmartSearchBoxProps) {
  const [chatOpen, setChatOpen] = useState(false);
  useEffect(() => { onChatOpenChange?.(chatOpen); }, [chatOpen, onChatOpenChange]);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [savedTurns, setSavedTurns] = useState(() => loadConversation().length);

  const askQuestion = useCallback((text: string) => {
    setPendingQuestion({ id: `${Date.now()}-${Math.random()}`, text });
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => {
    setChatOpen(false);
    setPendingQuestion(null);
    setSavedTurns(loadConversation().length);
  }, []);

  const content = chatOpen ? (
    <Suspense fallback={<p className="px-3 py-6 text-sm text-muted-foreground">상담 창을 여는 중…</p>}>
      <PatentChat onOpenPatent={onSubmit} pendingQuestion={pendingQuestion} onClose={closeChat} />
    </Suspense>
  ) : (
    <PatentInput
      onSubmit={onSubmit}
      isLoading={isLoading}
      onKeywordSearch={onKeywordSearch}
      placeholder={placeholder}
      skipKeywordFetch={skipKeywordFetch}
      onQuestion={askQuestion}
    />
  );

  return (
    <>
      {frame ? frame(content, chatOpen) : content}
      {!chatOpen && savedTurns > 0 && (
        <div className={resumeRowClassName}>
        <button
          type="button"
          onClick={() => { setPendingQuestion(null); setChatOpen(true); }}
          className={`mt-2 inline-flex items-center gap-1.5 rounded px-1 text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${resumeClassName ?? "text-primary"}`}
        >
          <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" /> 이전 대화 이어서 보기
        </button>
        </div>
      )}
    </>
  );
}
