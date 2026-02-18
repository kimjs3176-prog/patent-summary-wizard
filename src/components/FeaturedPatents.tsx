import { useEffect, useState } from "react";
import { Star, ChevronRight, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface FeaturedPatent {
  id: string;
  patent_number: string;
  title: string;
  description: string | null;
  recommendation_reason: string | null;
  category: string | null;
  transfer_status: string | null;
  contact_info: string | null;
  thumbnail_url: string | null;
  display_order: number;
  is_active: boolean;
}

interface FeaturedPatentsProps {
  onPatentSelect: (patentNumber: string) => void;
}

export function FeaturedPatents({ onPatentSelect }: FeaturedPatentsProps) {
  const [patents, setPatents] = useState<FeaturedPatent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const { data, error } = await supabase
          .from("featured_patents")
          .select("*")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (!error && data) {
          setPatents(data as unknown as FeaturedPatent[]);
        }
      } catch (err) {
        console.error("Featured patents fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  if (isLoading || patents.length === 0) return null;

  return (
    <section className="max-w-5xl mx-auto mt-10 md:mt-16 animate-fade-up">
      <div className="mb-5 flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
        <div>
          <h3 className="text-lg md:text-xl font-semibold text-foreground">이달의 특허 · 기술이전 추천</h3>
          <p className="text-xs text-muted-foreground mt-0.5">농식품 분야 기술이전 추천 특허</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patents.map((patent, index) => (
          <button
            key={patent.id}
            onClick={() => onPatentSelect(patent.patent_number)}
            className="group p-5 rounded-2xl bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 text-left border border-amber-200/50 dark:border-amber-800/30 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all duration-200 animate-fade-up"
            style={{ animationDelay: `${0.05 + index * 0.05}s` }}
          >
            <div className="flex items-start gap-3 mb-3">
              {patent.thumbnail_url ? (
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(patent.thumbnail_url)}`}
                  alt=""
                  className="w-14 h-14 rounded-xl object-cover bg-muted flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Star className="w-6 h-6 text-amber-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    {patent.patent_number}
                  </span>
                  {patent.category && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">
                      {patent.category}
                    </Badge>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors leading-snug">
                  {patent.title}
                </h4>
              </div>
            </div>

            {patent.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                {patent.description}
              </p>
            )}

            {patent.recommendation_reason && (
              <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 mb-2 line-clamp-2">
                💡 {patent.recommendation_reason}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                {patent.transfer_status && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 border-emerald-300 text-emerald-600 dark:text-emerald-400">
                    {patent.transfer_status}
                  </Badge>
                )}
                {patent.contact_info && (
                  <span className="truncate max-w-[150px]">{patent.contact_info}</span>
                )}
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
