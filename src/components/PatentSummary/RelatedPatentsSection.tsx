import { useState, useEffect } from "react";
import { Link2, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RelatedPatent, PatentData } from "./types";

interface RelatedPatentsSectionProps {
  relatedPatents: RelatedPatent[];
  onPatentClick?: (patentNumber: string) => void;
  patentData?: PatentData | null;
}

interface AiRecommendedPatent {
  patentId: string;
  title: string;
  assignee?: string;
  publicationDate?: string;
  snippet?: string;
  thumbnail?: string;
  relevanceGroup: number;
}

export function RelatedPatentsSection({ relatedPatents, onPatentClick, patentData }: RelatedPatentsSectionProps) {
  const [aiPatents, setAiPatents] = useState<AiRecommendedPatent[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiSearchQueries, setAiSearchQueries] = useState<string[]>([]);
  const [aiLoaded, setAiLoaded] = useState(false);

  const fetchAiRecommendations = async () => {
    if (!patentData?.title && !patentData?.abstract) return;
    
    setIsLoadingAi(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommend-similar-patents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            title: patentData?.titleKo || patentData?.title || "",
            abstract: patentData?.abstract || "",
            classifications: patentData?.classifications || [],
            patentNumber: patentData?.patentNumber || patentData?.displayNumber || "",
          }),
        }
      );

      const result = await response.json();
      if (result.success && result.patents) {
        setAiPatents(result.patents);
        setAiSearchQueries(result.searchQueries || []);
      }
    } catch (error) {
      console.error("AI recommendation error:", error);
    } finally {
      setIsLoadingAi(false);
      setAiLoaded(true);
    }
  };

  // Auto-fetch AI recommendations when patent data is available
  useEffect(() => {
    if (patentData && !aiLoaded) {
      fetchAiRecommendations();
    }
  }, [patentData]);

  // Reset when patent changes
  useEffect(() => {
    setAiPatents([]);
    setAiLoaded(false);
    setAiSearchQueries([]);
  }, [patentData?.patentNumber]);

  const handlePatentClick = (patent: RelatedPatent | AiRecommendedPatent) => {
    let patentNumber = patent.patentId || "";
    patentNumber = patentNumber
      .replace("patent/", "")
      .replace("/en", "")
      .replace("/ko", "")
      .trim();
    
    if (patentNumber && onPatentClick) {
      onPatentClick(patentNumber);
    }
  };

  const hasRelated = relatedPatents.length > 0;
  const hasAi = aiPatents.length > 0;

  if (!hasRelated && !hasAi && !isLoadingAi) return null;

  return (
    <div className="space-y-6">
      {/* Existing related patents */}
      {hasRelated && (
        <div
          className="related-patents-section mt-6 glass-effect rounded-3xl overflow-hidden animate-slide-in border-t-[3px]"
          style={{ animationDelay: "0.2s", borderTopColor: 'hsl(220 70% 50%)' }}
        >
          <div className="border-b border-border/50 px-6 py-4" style={{ background: 'linear-gradient(135deg, hsl(220 50% 96%), hsl(230 40% 95%))' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, hsl(220 70% 50%), hsl(240 60% 45%))', color: 'white' }}>
                🔗
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: 'hsl(220 60% 35%)' }}>유사 특허</h3>
                <p className="text-sm text-muted-foreground">{relatedPatents.length}건의 관련 특허</p>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {relatedPatents.map((patent, index) => (
                <div
                  key={patent.patentId || index}
                  className="p-5 rounded-2xl bg-secondary/30 border border-border/50 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer"
                  onClick={() => handlePatentClick(patent)}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2 py-1 text-xs rounded-lg bg-accent/20 text-accent font-medium">
                      {patent.patentId?.replace("patent/", "").replace("/en", "") || "번호 없음"}
                    </span>
                    <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      요약 →
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground line-clamp-2 mb-2">{patent.title}</h4>
                  {patent.snippet && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{patent.snippet}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                    {patent.assignee && <span className="truncate max-w-[120px]">{patent.assignee}</span>}
                    {patent.assignee && patent.publicationDate && <span>•</span>}
                    {patent.publicationDate && <span>{patent.publicationDate}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Recommended Patents */}
      {(hasAi || isLoadingAi) && (
        <div
          className="related-patents-section mt-6 glass-effect rounded-3xl overflow-hidden animate-slide-in border-t-[3px]"
          style={{ animationDelay: "0.3s", borderTopColor: 'hsl(158 64% 40%)' }}
        >
          <div className="border-b border-border/50 px-6 py-4" style={{ background: 'linear-gradient(135deg, hsl(158 40% 96%), hsl(170 35% 95%))' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, hsl(158 64% 40%), hsl(170 50% 35%))', color: 'white' }}>
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: 'hsl(158 50% 30%)' }}>
                    AI 추천 유사 특허
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isLoadingAi ? "AI가 유사 특허를 찾고 있습니다..." : `${aiPatents.length}건의 AI 추천 특허`}
                  </p>
                </div>
              </div>
              {aiLoaded && !isLoadingAi && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchAiRecommendations}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  다시 추천
                </Button>
              )}
            </div>
          </div>

          <div className="p-5 md:p-6">
            {isLoadingAi ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'hsl(158 64% 40%)' }} />
                <p className="text-sm text-muted-foreground">AI가 기술 키워드를 분석하여 유사 특허를 검색 중...</p>
              </div>
            ) : (
              <>
                {aiSearchQueries.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                    <span className="text-[11px] text-muted-foreground/70 font-medium">AI 검색 키워드:</span>
                    {aiSearchQueries.map((q, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border" style={{ background: 'hsl(158 64% 40% / 0.06)', color: 'hsl(158 50% 35%)', borderColor: 'hsl(158 64% 40% / 0.15)' }}>
                        {q}
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {aiPatents.map((patent, index) => (
                    <div
                      key={patent.patentId || index}
                      className="p-5 rounded-2xl bg-secondary/30 border border-border/50 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer relative"
                      onClick={() => handlePatentClick(patent)}
                    >
                      {patent.relevanceGroup === 0 && (
                        <div className="absolute -top-1.5 -right-1.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white" style={{ background: 'hsl(158 64% 40%)' }}>
                            <Sparkles className="w-2.5 h-2.5" />
                            높은 관련도
                          </span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="px-2 py-1 text-xs rounded-lg font-medium" style={{ background: 'hsl(158 64% 40% / 0.1)', color: 'hsl(158 50% 35%)' }}>
                          {patent.patentId}
                        </span>
                        <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          요약 →
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm text-foreground line-clamp-2 mb-2">{patent.title}</h4>
                      {patent.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{patent.snippet}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                        {patent.assignee && <span className="truncate max-w-[120px]">{patent.assignee}</span>}
                        {patent.assignee && patent.publicationDate && <span>•</span>}
                        {patent.publicationDate && <span>{patent.publicationDate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
