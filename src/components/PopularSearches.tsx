import { useState, useEffect, useRef } from "react";
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {popular.map((item, idx) =>
          <PopularSearchItem key={item.patent_number} item={item} idx={idx} onSelect={onPatentSelect} />
        )}
      </div>
    </div>
  );

}