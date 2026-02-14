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
      const { data } = await supabase
        .from("patent_search_stats")
        .select("patent_number, patent_title, search_count")
        .order("search_count", { ascending: false })
        .limit(5);
      if (data && data.length > 0) {
        setPopular(data);
      }
    };
    fetchPopular();
  }, []);

  if (popular.length === 0) return null;

  return (
    <div className="w-full lg:max-w-xs">
      <div className="bg-card/90 backdrop-blur-sm rounded-2xl p-4 md:p-5 border border-border/60 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-sm font-bold text-foreground">인기 검색</span>
        </div>
        <div className="space-y-1">
          {popular.map((item, idx) => (
            <button
              key={item.patent_number}
              onClick={() => onPatentSelect(item.patent_number)}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-accent/5 transition-all duration-200 group flex items-start gap-2.5"
            >
              <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                idx === 0 ? "bg-accent/15 text-accent" :
                idx === 1 ? "bg-primary/12 text-primary" :
                "bg-muted/80 text-muted-foreground"
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                  {item.patent_title || item.patent_number}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {item.patent_number} · {item.search_count}회
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
