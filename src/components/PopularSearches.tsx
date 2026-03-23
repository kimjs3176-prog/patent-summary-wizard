import { useState, useEffect, useRef } from "react";
import { TrendingUp, Flame } from "lucide-react";
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
      <div className="flex items-center gap-2 mb-2">
        <Flame className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">인기 검색</span>
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
  const textRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    const container = containerRef.current;
    if (el && container) {
      setIsOverflowing(el.scrollWidth > container.clientWidth);
    }
  }, [item.patent_title]);

  const title = item.patent_title || item.patent_number;
  const scrollDuration = Math.max(3, title.length * 0.15);

  return (
    <button
      onClick={() => onSelect(item.patent_number)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-primary/5 transition-colors group min-w-0"
      title={`${item.patent_number} · ${item.search_count}회`}
    >
      <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold transition-colors ${
        idx < 3 ? 'text-primary-foreground' : 'bg-secondary text-muted-foreground'
      }`} style={idx < 3 ? { background: 'var(--gradient-accent)' } : undefined}>
        {idx + 1}
      </span>
      <div ref={containerRef} className="overflow-hidden min-w-0 flex-1">
        <span
          ref={textRef}
          className="text-xs font-medium text-foreground group-hover:text-primary transition-colors whitespace-nowrap inline-block"
          style={isHovered && isOverflowing ? {
            animation: `marquee ${scrollDuration}s linear infinite`,
          } : undefined}
        >
          {title}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 tabular-nums">{item.search_count}회</span>
    </button>
  );
}
