import { useEffect, useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import { PatentData } from "./types";
import { safeFetch } from "@/lib/safeFetch";

interface AiRecommendedPatent {
  patentId: string;
  title: string;
  assignee?: string;
  publicationDate?: string;
  snippet?: string;
  similarityScore?: number;
  relevanceGroup?: number;
}

interface Props {
  patentData: PatentData;
  onPatentClick?: (patentNumber: string) => void;
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.substring(0, n - 1) + "…" : s;
}

export function RelatedPatentsCompact({ patentData, onPatentClick }: Props) {
  const [patents, setPatents] = useState<AiRecommendedPatent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!patentData?.title && !patentData?.titleKo) return;
      setLoading(true);
      setError(null);
      setPatents([]);

      const callRecommend = async (overrideTitle?: string, overrideAbstract?: string) => {
        const res = await safeFetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommend-similar-patents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              title: overrideTitle ?? (patentData.titleKo || patentData.title || ""),
              abstract: overrideAbstract ?? (patentData.abstract || ""),
              classifications: patentData.classifications || [],
              patentNumber: patentData.patentNumber || patentData.displayNumber || "",
            }),
            timeoutMs: 30000,
            retries: 1,
          }
        );
        return res.json().catch(() => ({ success: false, patents: [] }));
      };

      const dedupe = (list: AiRecommendedPatent[]) => {
        const cur = (patentData.patentNumber || patentData.displayNumber || patentData.applicationNumber || "").replace(/[^0-9]/g, "");
        return list.filter((p) => {
          const pn = (p.patentId || "").replace(/[^0-9]/g, "");
          if (!pn || !cur) return true;
          return !(pn.includes(cur) || cur.includes(pn));
        });
      };

      try {
        let json = await callRecommend();
        let list: AiRecommendedPatent[] = json.success ? (json.patents || []) : [];
        let filtered = dedupe(list);

        if (filtered.length === 0) {
          const stop = new Set(["방법", "장치", "시스템", "기술", "이용", "위한", "관한", "관련", "포함", "제공", "그리고", "또는", "있는", "되는", "사용", "통해", "통한", "및"]);
          const tokens = (patentData.titleKo || patentData.title || "")
            .replace(/[\[\](),.·\-/]/g, " ")
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length >= 2 && !stop.has(t));
          if (tokens.length) {
            const sorted = [...tokens].sort((a, b) => b.length - a.length);
            json = await callRecommend(sorted.slice(0, 3).join(" "), "");
            filtered = dedupe(json.success ? (json.patents || []) : []);
          }
        }

        if (cancelled) return;
        if (filtered.length === 0) {
          setError("기능·특징이 유사한 특허를 찾지 못했습니다.");
        } else {
          setPatents(filtered.slice(0, 6));
        }
      } catch (e) {
        if (!cancelled) setError("관련 특허를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [patentData?.patentNumber, patentData?.displayNumber]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[13px] text-[#8B95A1]">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>기능·특징이 유사한 특허를 찾는 중...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-[13px] text-[#8B95A1] py-2">{error}</p>;
  }

  if (patents.length === 0) return null;

  return (
    <ul className="divide-y divide-[#E5E8EB]">
      {patents.map((p, i) => {
        const score = p.similarityScore ?? 0;
        return (
          <li key={p.patentId || i}>
            <button
              onClick={() => onPatentClick?.(p.patentId)}
              className="w-full flex items-center justify-between gap-3 py-3 px-1 text-left hover:bg-white/60 rounded-lg transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[#191F28] truncate group-hover:text-[#10B981] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 shrink-0 text-[#8B95A1] group-hover:text-[#10B981]" />
                  {p.title}
                </p>
                <p className="text-[11.5px] text-[#8B95A1] tabular-nums mt-0.5 pl-5">
                  {p.patentId}{p.assignee ? ` · ${truncate(p.assignee, 24)}` : ""}
                </p>
              </div>
              {score > 0 && (
                <span
                  className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: score >= 80 ? "#10B98115" : score >= 60 ? "#3B82F615" : "#E5E8EB",
                    color: score >= 80 ? "#10B981" : score >= 60 ? "#3B82F6" : "#8B95A1",
                  }}
                >
                  유사도 {score}%
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}