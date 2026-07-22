import { useState, useEffect } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PopularSearch {
  patent_number: string;
  patent_title: string | null;
  search_count: number;
}

interface PopularSearchesProps {
  onPatentSelect: (patentNumber: string) => void;
}

type RankingMode = "all" | "month";
const ROTATE_MS = 8000;

export function PopularSearches({ onPatentSelect }: PopularSearchesProps) {
  const [allTime, setAllTime] = useState<PopularSearch[]>([]);
  const [monthly, setMonthly] = useState<PopularSearch[]>([]);
  const [mode, setMode] = useState<RankingMode>("all");

  useEffect(() => {
    (async () => {
      const [{ data: allData }, { data: monthData }] = await Promise.all([
        supabase
          .from("patent_search_stats")
          .select("patent_number, patent_title, search_count")
          .order("search_count", { ascending: false })
          .limit(6),
        supabase.rpc("get_monthly_popular_searches", { p_limit: 6 }),
      ]);
      if (allData) setAllTime(allData as PopularSearch[]);
      if (monthData) {
        setMonthly(
          (monthData as { patent_number: string; patent_title: string | null; search_count: number | string }[]).map((r) => ({
            patent_number: r.patent_number,
            patent_title: r.patent_title,
            search_count: Number(r.search_count),
          }))
        );
      }
    })();
  }, []);

  // Auto-rotate between all-time and monthly if both have data
  useEffect(() => {
    if (allTime.length === 0 || monthly.length === 0) return;
    const id = window.setInterval(() => {
      setMode((m) => (m === "all" ? "month" : "all"));
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [allTime.length, monthly.length]);

  const effectiveMode: RankingMode =
    mode === "month" && monthly.length === 0 ? "all" : mode;
  const popular = effectiveMode === "month" ? monthly : allTime;

  if (allTime.length === 0 && monthly.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2.5">
        <Flame className="w-4 h-4 text-primary" />
        <span className="text-[13px] font-bold text-foreground">인기 검색</span>
        <div className="ml-auto inline-flex items-center gap-0.5 rounded-full border border-border/50 bg-secondary/40 p-0.5">
          <button
            onClick={() => setMode("all")}
            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold transition-colors ${
              effectiveMode === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            누적
          </button>
          <button
            onClick={() => setMode("month")}
            disabled={monthly.length === 0}
            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold transition-colors disabled:opacity-40 ${
              effectiveMode === "month"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            이번달
          </button>
        </div>
      </div>
      <div key={effectiveMode} className="flex flex-col gap-0.5 animate-fade-in">
        {popular.map((item, idx) =>
          <PopularSearchItem key={item.patent_number} item={item} idx={idx} onSelect={onPatentSelect} />
        )}
        {popular.length === 0 && (
          <p className="text-[11.5px] text-muted-foreground/70 px-2 py-3">이번 달 검색 데이터가 아직 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function PopularSearchItem({ item, idx, onSelect }: { item: PopularSearch; idx: number; onSelect: (pn: string) => void }) {
  const title = item.patent_title || item.patent_number;

  return (
    <button
      onClick={() => onSelect(item.patent_number)}
      className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-primary/5 transition-colors group min-w-0"
      title={`${title} · ${item.search_count}회`}
    >
      <span className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold transition-colors ${
        idx < 3 ? 'text-primary-foreground' : 'bg-secondary text-muted-foreground'
      }`} style={idx < 3 ? { background: 'var(--gradient-accent)' } : undefined}>
        {idx + 1}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <span className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors block truncate">
          {title}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground/60 flex-shrink-0 tabular-nums">{item.search_count}회</span>
    </button>
  );
}
