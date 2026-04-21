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

export function PopularSearches({ onPatentSelect }: PopularSearchesProps) {
  const [popular, setPopular] = useState<PopularSearch[]>([]);

  useEffect(() => {
    const fetchPopular = async () => {
      const { data } = await supabase.
      from("patent_search_stats").
      select("patent_number, patent_title, search_count").
      order("search_count", { ascending: false }).
      limit(6);
      if (data && data.length > 0) setPopular(data);
    };
    fetchPopular();
  }, []);

  if (popular.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2.5">
        <Flame className="w-4 h-4 text-primary" />
        <span className="text-[13px] font-bold text-foreground">인기 검색</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {popular.map((item, idx) =>
          <PopularSearchItem key={item.patent_number} item={item} idx={idx} onSelect={onPatentSelect} />
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
