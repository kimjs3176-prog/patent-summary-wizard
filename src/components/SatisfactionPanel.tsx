import { useEffect, useState } from "react";
import { Star, Send, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  patentNumber?: string;
  className?: string;
}

const LABELS = ["매우 불만족", "불만족", "보통", "만족", "매우 만족"];

export const SatisfactionPanel = ({ patentNumber, className = "" }: Props) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setRating(0); setComment(""); setDone(false);
  }, [patentNumber]);

  const submit = async () => {
    if (!rating) { toast.error("별점을 선택해 주세요."); return; }
    setSending(true);
    const { error } = await supabase.rpc("submit_satisfaction", {
      p_rating: rating,
      p_patent_number: patentNumber ?? null,
      p_comment: comment.trim() || null,
    });
    setSending(false);
    if (error) { toast.error("제출에 실패했습니다."); return; }
    setDone(true);
    toast.success("소중한 의견 감사합니다!");
  };

  const active = hover || rating;

  return (
    <aside className={`w-[240px] rounded-[20px] border border-[#F2F4F6] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}>
      {done ? (
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Check className="w-5 h-5" />
          </div>
          <p className="text-[13px] font-bold text-[#191F28]">응답이 등록되었습니다</p>
          <p className="text-[12px] text-[#8B95A1] mt-1">더 나은 분석으로 보답하겠습니다.</p>
        </div>
      ) : (
        <>
          <p className="text-[13px] font-bold text-[#191F28]">이 분석이 도움이 되셨나요?</p>
          <p className="text-[11px] text-[#8B95A1] mt-1 mb-3">만족도를 남겨주시면 서비스 개선에 반영합니다.</p>
          <div className="flex items-center gap-1 mb-1.5" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n}점`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star className={`w-6 h-6 ${n <= active ? "fill-amber-400 text-amber-400" : "text-[#D1D6DB]"}`} />
              </button>
            ))}
          </div>
          <p className="text-[11px] font-medium text-[#8B95A1] h-4 mb-2">{active ? LABELS[active - 1] : ""}</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="개선 의견 (선택)"
            className="w-full rounded-[12px] border border-[#E5E8EB] bg-[#F9FAFB] px-3 py-2 text-[12px] outline-none focus:border-primary/50 resize-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="mt-2 w-full h-9 rounded-[12px] bg-primary text-primary-foreground text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" /> {sending ? "제출 중..." : "만족도 제출"}
          </button>
        </>
      )}
    </aside>
  );
};
