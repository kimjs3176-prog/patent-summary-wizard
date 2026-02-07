import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

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

export function RdaLatestPatents({ onPatentSelect }: RdaLatestPatentsProps) {
  const [patents, setPatents] = useState<RdaPatent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (result.success && result.patents) {
          setPatents(result.patents);
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
      <section className="max-w-5xl mx-auto mt-16">
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="text-muted-foreground">농촌진흥청 최신 특허 로딩 중...</span>
        </div>
      </section>
    );
  }

  if (error || patents.length === 0) {
    return null; // 에러시 섹션 숨김
  }

  return (
    <section className="max-w-5xl mx-auto mt-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">농촌진흥청 최신 특허</h3>
          <p className="text-sm text-muted-foreground">대한민국(농촌진흥청장) 출원 특허</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {patents.map((patent, index) => (
          <button
            key={patent.patentId}
            onClick={() => onPatentSelect(patent.patentId)}
            className="group p-5 rounded-2xl glass-effect text-left hover:shadow-glow transition-all duration-300 animate-slide-in border border-border/50 hover:border-primary/50"
            style={{ animationDelay: `${0.1 + index * 0.05}s` }}
          >
            <div className="flex items-start gap-3 mb-3">
              {patent.thumbnail ? (
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(patent.thumbnail)}`}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover bg-secondary/50 flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🌱</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-md bg-accent/20 text-accent mb-1">
                  {patent.patentId}
                </span>
                <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {patent.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate max-w-[60%]">{patent.applicant}</span>
              <span>{patent.applicationDate}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
