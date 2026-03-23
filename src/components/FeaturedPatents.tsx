import { useEffect, useState } from "react";
import { Star, ArrowRight, Loader2 } from "lucide-react";
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
  sectionTitle?: string;
  sectionSubtitle?: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "기계설비용품": "🔧",
  "기능성소재": "🧬",
  "식품": "🍚",
  "재배생육": "🌾",
  "환경·에너지": "🌿",
  "기타": "📋",
  "잠재기술": "💡",
  "전체": "⭐",
};

export function FeaturedPatents({ onPatentSelect, sectionTitle, sectionSubtitle }: FeaturedPatentsProps) {
  const [patents, setPatents] = useState<FeaturedPatent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("전체");

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

  if (isLoading) {
    return (
      <section className="max-w-5xl mx-auto mt-10 md:mt-16">
        <div className="flex items-center justify-center gap-3 py-10">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          <span className="text-sm text-muted-foreground">이달의 특허 로딩 중...</span>
        </div>
      </section>
    );
  }

  if (patents.length === 0) return null;

  const categories = ["전체", ...Array.from(new Set(patents.map(p => p.category).filter(Boolean) as string[]))];
  const filteredPatents = activeTab === "전체" ? patents : patents.filter(p => p.category === activeTab);

  return (
    <section className="max-w-5xl mx-auto mt-10 md:mt-16 animate-fade-up">
      {/* Section Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'hsl(38 92% 50% / 0.12)' }}>
            <Star className="w-3.5 h-3.5" style={{ color: 'hsl(38 92% 50%)' }} />
          </div>
          <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
            {sectionTitle || "이달의 특허 · 기술이전 추천"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground ml-[38px]">
          {sectionSubtitle || "농식품 분야 기술이전 추천 특허"}
        </p>
      </div>

      {/* Category Tabs */}
      {categories.length > 2 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {categories.map((cat) => {
            const count = cat === "전체" ? patents.length : patents.filter(p => p.category === cat).length;
            const isActive = activeTab === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 btn-press ${
                  isActive
                    ? "text-primary-foreground shadow-sm"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                style={isActive ? { background: 'var(--gradient-accent)' } : undefined}
              >
                <span>{CATEGORY_EMOJI[cat] || "📋"}</span>
                <span>{cat}</span>
                <span className={`ml-0.5 text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Patent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {filteredPatents.map((patent, index) => (
          <button
            key={patent.id}
            onClick={() => onPatentSelect(patent.patent_number)}
            className="group p-4 md:p-5 rounded-2xl bg-card text-left border border-border/40 hover:border-border/70 hover:shadow-lg backdrop-blur-sm transition-all duration-300 animate-fade-up card-interactive btn-press"
            style={{ animationDelay: `${0.05 + index * 0.03}s`, boxShadow: 'var(--shadow-glossy)' }}
          >
            <div className="flex items-start gap-3 mb-3">
              {patent.thumbnail_url ? (
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(patent.thumbnail_url)}`}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover bg-muted flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-md bg-secondary text-muted-foreground">
                    {patent.patent_number}
                  </span>
                  {patent.category && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 bg-primary/8 text-primary border-0">
                      {patent.category}
                    </Badge>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                  {patent.title}
                </h4>
              </div>
            </div>

            {patent.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5 leading-relaxed">
                {patent.description}
              </p>
            )}

            {patent.recommendation_reason && (
              <div className="text-xs rounded-lg px-3 py-2 mb-2.5 line-clamp-2 bg-primary/5 text-foreground/70">
                💡 {patent.recommendation_reason}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
              <div className="flex items-center gap-2">
                {patent.transfer_status && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 border-primary/30 text-primary">
                    {patent.transfer_status}
                  </Badge>
                )}
                {patent.contact_info && (
                  <span className="truncate max-w-[150px]">{patent.contact_info}</span>
                )}
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all text-primary arrow-slide" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
