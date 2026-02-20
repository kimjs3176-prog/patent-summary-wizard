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

const CATEGORY_COLORS: Record<string, { from: string; to: string; border: string; hoverBorder: string; badge: string; badgeText: string; reason: string }> = {
  "기계설비용품": { from: "from-slate-50/80", to: "to-zinc-50/50", border: "border-slate-200/50", hoverBorder: "hover:border-slate-300", badge: "bg-slate-100 dark:bg-slate-900/40", badgeText: "text-slate-700 dark:text-slate-300", reason: "bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-400" },
  "기능성소재": { from: "from-purple-50/80", to: "to-violet-50/50", border: "border-purple-200/50", hoverBorder: "hover:border-purple-300", badge: "bg-purple-100 dark:bg-purple-900/40", badgeText: "text-purple-700 dark:text-purple-300", reason: "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400" },
  "식품": { from: "from-orange-50/80", to: "to-red-50/50", border: "border-orange-200/50", hoverBorder: "hover:border-orange-300", badge: "bg-orange-100 dark:bg-orange-900/40", badgeText: "text-orange-700 dark:text-orange-300", reason: "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400" },
  "재배생육": { from: "from-green-50/80", to: "to-emerald-50/50", border: "border-green-200/50", hoverBorder: "hover:border-green-300", badge: "bg-green-100 dark:bg-green-900/40", badgeText: "text-green-700 dark:text-green-300", reason: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" },
  "환경·에너지": { from: "from-teal-50/80", to: "to-cyan-50/50", border: "border-teal-200/50", hoverBorder: "hover:border-teal-300", badge: "bg-teal-100 dark:bg-teal-900/40", badgeText: "text-teal-700 dark:text-teal-300", reason: "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400" },
  "잠재기술": { from: "from-blue-50/80", to: "to-indigo-50/50", border: "border-blue-200/50", hoverBorder: "hover:border-blue-300", badge: "bg-blue-100 dark:bg-blue-900/40", badgeText: "text-blue-700 dark:text-blue-300", reason: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" },
  "기타": { from: "from-gray-50/80", to: "to-stone-50/50", border: "border-gray-200/50", hoverBorder: "hover:border-gray-300", badge: "bg-gray-100 dark:bg-gray-900/40", badgeText: "text-gray-700 dark:text-gray-300", reason: "bg-gray-50 dark:bg-gray-950/30 text-gray-700 dark:text-gray-400" },
};

const DEFAULT_COLORS = { from: "from-amber-50/80", to: "to-orange-50/50", border: "border-amber-200/50", hoverBorder: "hover:border-amber-300", badge: "bg-amber-100 dark:bg-amber-900/40", badgeText: "text-amber-700 dark:text-amber-300", reason: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" };

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

  // Build category list
  const categories = ["전체", ...Array.from(new Set(patents.map(p => p.category).filter(Boolean) as string[]))];
  const filteredPatents = activeTab === "전체" ? patents : patents.filter(p => p.category === activeTab);

  return (
    <section className="max-w-5xl mx-auto mt-10 md:mt-16 animate-fade-up">
      <div className="mb-5 flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
        <div>
          <h3 className="text-lg md:text-xl font-semibold text-foreground">
            {sectionTitle || "이달의 특허 · 기술이전 추천"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sectionSubtitle || "농식품 분야 기술이전 추천 특허"}
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      {categories.length > 2 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {categories.map((cat) => {
            const count = cat === "전체" ? patents.length : patents.filter(p => p.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-200 border ${
                  activeTab === cat
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <span>{CATEGORY_EMOJI[cat] || "📋"}</span>
                <span>{cat}</span>
                <Badge variant="secondary" className={`ml-1 px-1.5 py-0 text-[10px] h-4 ${
                  activeTab === cat ? "bg-background/20 text-background border-0" : ""
                }`}>
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Patent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {filteredPatents.map((patent, index) => {
          const colors = CATEGORY_COLORS[patent.category || ""] || DEFAULT_COLORS;
          return (
          <button
            key={patent.id}
            onClick={() => onPatentSelect(patent.patent_number)}
            className={`group p-4 md:p-5 rounded-2xl bg-gradient-to-br ${colors.from} ${colors.to} dark:from-zinc-900/20 dark:to-zinc-800/10 text-left border ${colors.border} dark:border-zinc-700/30 ${colors.hoverBorder} dark:hover:border-zinc-600 hover:shadow-md transition-all duration-200 animate-fade-up`}
            style={{ animationDelay: `${0.05 + index * 0.03}s` }}
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
                <div className={`w-14 h-14 rounded-xl ${colors.badge} flex items-center justify-center flex-shrink-0`}>
                  <Star className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-md ${colors.badge} ${colors.badgeText}`}>
                    {patent.patent_number}
                  </span>
                  {patent.category && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">
                      {patent.category}
                    </Badge>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors leading-snug">
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
              <div className={`text-xs ${colors.reason} rounded-lg px-3 py-2 mb-2 line-clamp-2`}>
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
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
            </div>
          </button>
          );
        })}
      </div>
    </section>
  );
}
