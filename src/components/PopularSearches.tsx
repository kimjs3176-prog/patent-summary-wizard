import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
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
        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">인기 검색</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {popular.map((item, idx) =>
          <button
            key={item.patent_number}
            onClick={() => onPatentSelect(item.patent_number)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-border/40 bg-card/80 backdrop-blur-sm hover:border-foreground/15 hover:shadow-sm transition-all duration-200 group btn-press"
            style={{ boxShadow: 'var(--shadow-glossy)' }}
            title={`${item.patent_number} · ${item.search_count}회`}
          >
            <span className="flex-shrink-0 w-4.5 h-4.5 rounded-md bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground num-highlight">
              {idx + 1}
            </span>
            <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
              {item.patent_title ? (item.patent_title.length > 20 ? item.patent_title.slice(0, 20) + '…' : item.patent_title) : item.patent_number}
            </span>
          </button>
        )}
      </div>
    </div>
  );

}