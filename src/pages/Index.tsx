import { Heart, RotateCcw, Sparkles, BarChart3 } from "lucide-react";
import { AiHeroAnimation } from "@/components/AiHeroAnimation";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PatentInput } from "@/components/PatentInput";
import { TossPatentSummary } from "@/components/PatentSummary/TossPatentSummary";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import { useSearchHistory, SearchHistoryItem } from "@/hooks/useSearchHistory";
import { SearchHistory } from "@/components/SearchHistory";
import { Button } from "@/components/ui/button";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { FeaturedPatents } from "@/components/FeaturedPatents";
import { TechTransferGuide } from "@/components/TechTransferGuide";
import { TechVideoSection } from "@/components/TechVideoSection";
import { PopularSearches } from "@/components/PopularSearches";
import { KeywordExplorer } from "@/components/KeywordExplorer";

import { trackPatentSearch } from "@/hooks/useTrackSearch";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { AnalysisProgressStepper } from "@/components/AnalysisProgressStepper";
import { NoticeSection } from "@/components/NoticeSection";

import { useState, useEffect, useRef, useMemo } from "react";
import { PageLayout } from "@/components/layout/PageLayout";

const Index = () => {
  const navigate = useNavigate();
  const {
    isLoading, isFetching, summary, currentPatent, patentData,
    relatedPatents, analysisStep, generateSummary,
    loadFromHistory, reset
  } = usePatentSummary();
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  const { settings } = useSiteSettings();
  const { favorites } = useFavoritePatents();
  const resultRef = useRef<HTMLDivElement>(null);

  const homepageVisible = useMemo(() => {
    try { return settings.homepage_visible_sections ? JSON.parse(settings.homepage_visible_sections) : {}; } catch { return {}; }
  }, [settings.homepage_visible_sections]);

  const [keywordResults] = useState<KeywordSearchResult[]>([]);
  const initialLoadDone = useRef(false);

  const updateUrl = (patentNum?: string) => {
    if (patentNum) {
      window.history.replaceState(null, "", `?patent=${encodeURIComponent(patentNum)}`);
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  // Auto-scroll to results when analysis starts
  useEffect(() => {
    if (analysisStep === "fetching" && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [analysisStep]);

  const handleSubmitInternal = async (patentNumber: string) => {
    updateUrl(patentNumber);
    const result = await generateSummary(patentNumber);
    if (result && result.patentData) {
      addToHistory({
        patentNumber,
        patentData: result.patentData,
        summary: result.summary,
        relatedPatents: result.relatedPatents || []
      });
      trackPatentSearch(patentNumber, result.patentData.titleKo || result.patentData.title);
    }
  };

  // Update history with score when it becomes available
  const handleScoreReady = (score: number) => {
    if (!currentPatent) return;
    const stored = localStorage.getItem("patent-search-history");
    if (!stored) return;
    try {
      const items = JSON.parse(stored);
      const updated = items.map((item: SearchHistoryItem) =>
        item.patentNumber === currentPatent ? { ...item, commercializationScore: score } : item
      );
      localStorage.setItem("patent-search-history", JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const patentParam = params.get("patent");
    if (patentParam) handleSubmitInternal(patentParam);
  }, []);

  const handleSubmit = async (patentNumber: string) => {
    await handleSubmitInternal(patentNumber);
  };

  const handleHistorySelect = (item: SearchHistoryItem) => {
    updateUrl(item.patentNumber);
    loadFromHistory(item);
  };

  const handleKeywordSearch = (_results: KeywordSearchResult[], keyword: string) => {
    navigate(`/search?keyword=${encodeURIComponent(keyword)}`);
  };

  const handleKeywordTagClick = (keyword: string) => {
    navigate(`/search?keyword=${encodeURIComponent(keyword)}`);
  };

  const headerRight = (
    <>
      <Link to="/insights">
        <Button variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
          <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">인사이트</span>
        </Button>
      </Link>
      <Link to="/compare">
        <Button variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
          <Heart className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">관심특허</span>{favorites.length > 0 ? ` (${favorites.length})` : ""}
        </Button>
      </Link>
      {(summary || isLoading) && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { updateUrl(); reset(); }}
            className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card btn-press font-medium"
          >
            새로운 검색
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { updateUrl(); reset(); clearHistory(); toast.success("검색 기록이 초기화되었습니다"); }}
            className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-1.5 btn-press font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">초기화</span>
          </Button>
        </>
      )}
    </>
  );

  return (
    <PageLayout headerRight={headerRight}>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-5 md:py-8 relative z-10">
        {!summary && !isLoading ? (
          <>
            {/* Hero — 슬림화 */}
            <section className="text-center max-w-3xl mx-auto mb-5 md:mb-8 animate-fade-down relative py-4 md:py-8">
              <div className="absolute -inset-6 md:-inset-16 -z-10 overflow-hidden rounded-[2rem] md:rounded-[3rem]">
                <AiHeroAnimation />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] md:w-[520px] h-[160px] md:h-[280px] rounded-full -z-10 blur-[70px] md:blur-[120px] opacity-35 animate-float" style={{ background: 'radial-gradient(ellipse, hsl(158 64% 40% / 0.18), transparent 70%)' }} />

              <div className="inline-flex items-center gap-1.5 px-3 py-1 md:py-1.5 rounded-2xl mb-3 md:mb-5 text-[10px] md:text-xs font-semibold border backdrop-blur-xl" style={{ background: 'hsl(158 64% 40% / 0.05)', color: 'hsl(158 64% 40%)', borderColor: 'hsl(158 64% 40% / 0.1)' }}>
                <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />
                AI 기반 특허 분석
              </div>
              <h2 className="text-[20px] sm:text-[26px] md:text-[38px] lg:text-[44px] font-extrabold text-foreground mb-2 md:mb-4 leading-[1.15] md:leading-[1.1] tracking-[-0.02em] md:tracking-[-0.03em] px-2 whitespace-pre-line">
                {settings.hero_title}
                <br />
                <span className="gradient-text gradient-shimmer">{settings.hero_title_accent}</span> {settings.hero_title_suffix}
              </h2>
              <p className="text-[11px] sm:text-xs md:text-sm font-normal leading-relaxed max-w-[280px] sm:max-w-md mx-auto text-muted-foreground/70 tracking-tight">
                {settings.hero_description}
              </p>
            </section>

            {/* Search bar */}
            <section className="mb-5 md:mb-7 animate-fade-up relative z-20" style={{ animationDelay: "0.1s" }}>
              <div className="w-full max-w-2xl mx-auto flex flex-col relative z-40">
                <PatentInput onSubmit={handleSubmit} isLoading={isLoading} onKeywordSearch={handleKeywordSearch} placeholder={settings.search_placeholder} helperText={settings.search_helper_text} helperTexts={(() => { try { const t = JSON.parse(settings.search_helper_texts || "[]"); return Array.isArray(t) ? t.filter((s: string) => s.trim()) : []; } catch { return []; } })()} />
              </div>
            </section>

            {/* 주제별 빠른 탐색 (유지) */}
            <section className="max-w-5xl mx-auto mb-6 md:mb-10 animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <KeywordExplorer />
            </section>

            {/* 세로 스크롤 단일 컬럼 — 공지·기록 → 추천특허 → 기술영상 → 기술이전 안내 */}
            <div className="max-w-5xl mx-auto space-y-8 md:space-y-12 animate-fade-up" style={{ animationDelay: "0.2s" }}>
              {(homepageVisible.notices !== false || (settings.feature_search_history !== "false" && history.length > 0)) && (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  {homepageVisible.notices !== false && (
                    <div className="rounded-2xl border border-border/40 bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                      <NoticeSection compact />
                    </div>
                  )}
                  <div className="rounded-2xl border border-border/40 bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                    <PopularSearches onPatentSelect={handleSubmit} />
                  </div>
                  {settings.feature_search_history !== "false" && history.length > 0 && (
                    <div className="rounded-2xl border border-border/40 bg-card p-4 md:col-span-2" style={{ boxShadow: "var(--shadow-card)" }}>
                      <SearchHistory history={history} onSelect={handleHistorySelect} onRemove={removeFromHistory} onClear={clearHistory} />
                    </div>
                  )}
                </section>
              )}

              {homepageVisible.featuredPatents !== false && (
                <section>
                  <FeaturedPatents
                    onPatentSelect={handleSubmit}
                    sectionTitle={settings.featured_section_title}
                    sectionSubtitle={settings.featured_section_subtitle}
                  />
                </section>
              )}

              {homepageVisible.techVideos !== false && (
                <section>
                  <TechVideoSection videos={(() => {
                    try {
                      const parsed = JSON.parse(settings.tech_videos || "[]");
                      return Array.isArray(parsed) ? parsed : [];
                    } catch { return []; }
                  })()} />
                </section>
              )}

              {homepageVisible.techTransferGuide !== false && (
                <section id="tech-transfer">
                  <TechTransferGuide />
                </section>
              )}
            </div>
          </>
        ) : (
          <div ref={resultRef} data-results-visible="true">
            {isLoading && (<AnalysisProgressStepper currentStep={analysisStep} />)}
            <div className="sticky top-2 z-30 mb-5 md:mb-7">
              <div className="max-w-2xl mx-auto rounded-2xl bg-background/85 backdrop-blur-md p-1.5">
                <PatentInput
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  onKeywordSearch={handleKeywordSearch}
                  placeholder={settings.search_placeholder}
                />
              </div>
            </div>
            <section className="mb-8">
              <TossPatentSummary
                content={summary}
                patentNumber={currentPatent}
                isStreaming={isLoading}
                patentData={patentData}
                relatedPatents={relatedPatents}
                onRelatedPatentClick={handleSubmit}
                onKeywordClick={handleKeywordTagClick}
                onScoreReady={handleScoreReady}
                onRegenerate={async () => {
                  if (!currentPatent) return;
                  toast.info("요약서를 새로 생성합니다...");
                  const result = await generateSummary(currentPatent, { forceRegenerate: true });
                  if (result && result.patentData) {
                    addToHistory({
                      patentNumber: currentPatent,
                      patentData: result.patentData,
                      summary: result.summary,
                      relatedPatents: result.relatedPatents || [],
                    });
                  }
                }}
                featureFlags={{ pdfEnabled: settings.feature_pdf !== "false", pptEnabled: settings.feature_ppt !== "false" }}
              />
            </section>
          </div>
        )}
      </main>
    </PageLayout>
  );
};

export default Index;
