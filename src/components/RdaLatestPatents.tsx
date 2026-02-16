import { useEffect, useState } from "react";
import { Loader2, Sprout } from "lucide-react";

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
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          <span className="text-sm text-muted-foreground">농촌진흥청 최신 특허 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (error || patents.length === 0) return null;

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-2.5 mb-6">
        <Sprout className="w-4 h-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">농촌진흥청 최신 특허</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">대한민국(농촌진흥청장) 출원 특허</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {patents.map((patent, index) => (
          <button
            key={patent.patentId}
            onClick={() => onPatentSelect(patent.patentId)}
            className="group p-4 rounded-xl bg-background/60 hover:bg-background text-left border border-border/30 hover:border-border/60 transition-all duration-200"
          >
            <div className="flex items-start gap-3 mb-2.5">
              {patent.thumbnail ? (
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(patent.thumbnail)}`}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover bg-muted flex-shrink-0"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-base">🌱</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted text-muted-foreground mb-1">
                  {patent.patentId}
                </span>
                <h4 className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                  {patent.title}
                </h4>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="truncate max-w-[60%]">{patent.applicant}</span>
              <span>{patent.applicationDate}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
