import { useEffect, useState } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RdaPatent {
  patentId: string;
  title: string;
  applicant: string;
  applicationDate: string;
  thumbnail?: string;
}

interface RdaLatestPatentsProps {
  onPatentSelect: (patentId: string) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "식품·가공": "🍚",
  "기능성·바이오": "🧬",
  "작물·재배": "🌾",
  "농기계·스마트팜": "🚜",
  "축산·수산": "🐄",
  "병해충·환경": "🌿",
};

export function RdaLatestPatents({ onPatentSelect }: RdaLatestPatentsProps) {
  const [categories, setCategories] = useState<Record<string, RdaPatent[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    const fetchRdaPatents = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rda-latest-patents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );
        const result = await response.json();
        if (result.success && result.categories) {
          setCategories(result.categories);
          const firstKey = Object.keys(result.categories)[0];
          if (firstKey) setActiveTab(firstKey);
        } else {
          setError(result.error || "특허 조회 실패");
        }
      } catch (err) {
        console.error("RDA patents fetch error:", err);
        setError("네트워크 오류");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRdaPatents();
  }, []);

  if (isLoading) {
    return (
      <section className="max-w-5xl mx-auto mt-10 md:mt-16">
        <div className="flex items-center justify-center gap-3 py-10">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          <span className="text-sm text-muted-foreground">농촌진흥청 최신 특허 로딩 중...</span>
        </div>
      </section>
    );
  }

  const categoryKeys = Object.keys(categories);
  if (error || categoryKeys.length === 0) return null;

  const activePatents = categories[activeTab] || [];

  return (
    <section className="max-w-5xl mx-auto mt-10 md:mt-16">
      <div className="mb-5">
        <h3 className="text-lg md:text-xl font-semibold text-foreground">농촌진흥청 최신 특허</h3>
        <p className="text-xs text-muted-foreground mt-1">대한민국(농촌진흥청장) 출원 특허 · 분야별 탐색</p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {categoryKeys.map((cat) => (
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
              {categories[cat].length}
            </Badge>
          </button>
        ))}
      </div>

      {/* Patent Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {activePatents.map((patent, index) => (
          <button
            key={patent.patentId}
            onClick={() => onPatentSelect(patent.patentId)}
            className="group p-4 md:p-5 rounded-2xl bg-secondary/40 text-left border border-border/50 hover:bg-secondary/70 hover:border-border transition-all duration-200 animate-fade-up"
            style={{ animationDelay: `${0.05 + index * 0.03}s` }}
          >
            <div className="flex items-start gap-3 mb-3">
              {patent.thumbnail ? (
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(patent.thumbnail)}`}
                  alt=""
                  className="w-11 h-11 rounded-lg object-cover bg-muted flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{CATEGORY_EMOJI[activeTab] || "🌱"}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted text-muted-foreground mb-1">
                  {patent.patentId}
                </span>
                <h4 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                  {patent.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate max-w-[60%]">{patent.applicant}</span>
              <span className="flex items-center gap-0.5">
                {patent.applicationDate}
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
