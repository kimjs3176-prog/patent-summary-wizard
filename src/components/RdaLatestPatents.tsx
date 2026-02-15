import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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
      <section className="max-w-5xl mx-auto mt-10 md:mt-16">
        <div className="flex items-center justify-center gap-3 py-10">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          <span className="text-sm text-muted-foreground">농촌진흥청 최신 특허 로딩 중...</span>
        </div>
      </section>
    );
  }

  if (error || patents.length === 0) return null;

  return (
    <section className="max-w-5xl mx-auto mt-10 md:mt-16">
      <div className="mb-6">
        <h3 className="text-lg md:text-xl font-semibold text-foreground">농촌진흥청 최신 특허</h3>
        <p className="text-xs text-muted-foreground mt-1">대한민국(농촌진흥청장) 출원 특허</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {patents.map((patent, index) => (
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
                  <span className="text-lg">🌱</span>
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
              <span>{patent.applicationDate}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
