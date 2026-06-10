import { useEffect, useRef, useState } from "react";
import { Ban, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface HighlightProposerProps {
  /** AI 요약 본문을 감싸는 컨테이너 ref. 이 영역 안의 텍스트 선택만 감지. */
  containerRef: React.RefObject<HTMLElement>;
  /** 현재 보고 있는 특허 번호(컨텍스트 저장용) */
  patentNumber?: string;
}

interface PopoverState {
  x: number;
  y: number;
  text: string;
  context: string;
}

/**
 * AI 요약 본문에서 사용자가 텍스트를 드래그로 선택하면
 * "강조 제외 제안 / 강조 추가 제안" 인라인 팝오버를 띄운다.
 * 제안은 highlight_rule_proposals 테이블에 status='pending'으로 저장된다.
 */
export function HighlightProposer({ containerRef, patentNumber }: HighlightProposerProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [submitting, setSubmitting] = useState<"exclude" | "include" | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseUp = (e: MouseEvent) => {
      // 팝오버 내부 클릭은 무시
      if (popRef.current && popRef.current.contains(e.target as Node)) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setPopover(null); return; }
      const text = sel.toString().trim();
      if (text.length < 2 || text.length > 200) { setPopover(null); return; }

      const range = sel.getRangeAt(0);
      // 컨테이너 외부 선택은 무시
      if (!container.contains(range.commonAncestorContainer)) {
        setPopover(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      // 주변 문맥(앞뒤 60자) 추출
      const parentText = (range.commonAncestorContainer.textContent ?? "");
      const idx = parentText.indexOf(text);
      const ctx = idx >= 0
        ? parentText.slice(Math.max(0, idx - 60), Math.min(parentText.length, idx + text.length + 60))
        : text;

      setPopover({
        x: rect.left + rect.width / 2 + window.scrollX,
        y: rect.top + window.scrollY - 8,
        text,
        context: ctx,
      });
    };

    const handleScroll = () => setPopover(null);
    const handleClickAway = (e: MouseEvent) => {
      if (popRef.current && popRef.current.contains(e.target as Node)) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setPopover(null);
    };

    container.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("mousedown", handleClickAway);
    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("mousedown", handleClickAway);
    };
  }, [containerRef]);

  const submit = async (kind: "exclude" | "include") => {
    if (!popover) return;
    setSubmitting(kind);
    try {
      const { error } = await supabase.from("highlight_rule_proposals").insert({
        kind,
        phrase: popover.text,
        patent_number: patentNumber ?? null,
        context: popover.context,
        status: "pending",
      } as never);
      if (error) {
        // 중복(unique violation)은 사용자에게 부드럽게 안내
        if ((error as { code?: string }).code === "23505") {
          toast.info("이미 동일한 제안이 접수되어 있습니다.");
        } else {
          throw error;
        }
      } else {
        toast.success(kind === "exclude" ? "강조 제외 제안이 접수되었습니다." : "강조 추가 제안이 접수되었습니다.");
      }
      setPopover(null);
      window.getSelection()?.removeAllRanges();
    } catch (e) {
      toast.error("제안 전송 실패: " + ((e as Error).message || ""));
    } finally {
      setSubmitting(null);
    }
  };

  if (!popover) return null;

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="하이라이트 규칙 제안"
      className="fixed z-50 -translate-x-1/2 -translate-y-full flex items-center gap-1 rounded-[10px] bg-[#191F28] text-white text-[12px] font-semibold px-1.5 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
      style={{ left: popover.x, top: popover.y }}
      onMouseDown={(e) => e.preventDefault() /* keep selection */}
    >
      <button
        type="button"
        disabled={submitting !== null}
        onClick={() => submit("exclude")}
        className="flex items-center gap-1 px-2 py-1 rounded-[6px] hover:bg-white/10 disabled:opacity-50"
      >
        {submitting === "exclude" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3 text-[#FCA5A5]" />}
        강조 제외
      </button>
      <span className="w-px h-3 bg-white/20" />
      <button
        type="button"
        disabled={submitting !== null}
        onClick={() => submit("include")}
        className="flex items-center gap-1 px-2 py-1 rounded-[6px] hover:bg-white/10 disabled:opacity-50"
      >
        {submitting === "include" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-[#6EE7B7]" />}
        강조 추가
      </button>
      <span className="w-px h-3 bg-white/20" />
      <button
        type="button"
        aria-label="닫기"
        onClick={() => setPopover(null)}
        className="p-1 rounded-[6px] hover:bg-white/10"
      >
        <X className="w-3 h-3 text-white/70" />
      </button>
    </div>
  );
}