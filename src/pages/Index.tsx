import { Heart, RotateCcw, Sparkles } from "lucide-react";
import { AiHeroAnimation } from "@/components/AiHeroAnimation";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PatentInput } from "@/components/PatentInput";
import { PatentSummary } from "@/components/PatentSummary/index";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import { useSearchHistory, SearchHistoryItem } from "@/hooks/useSearchHistory";
import { SearchHistory } from "@/components/SearchHistory";
import { Button } from "@/components/ui/button";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { FeaturedPatents } from "@/components/FeaturedPatents";
import { TechTransferGuide } from "@/components/TechTransferGuide";
import { TechVideoSection } from "@/components/TechVideoSection";
import { PopularSearches } from "@/components/PopularSearches";
import { trackPatentSearch } from "@/hooks/useTrackSearch";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { AnalysisProgressStepper } from "@/components/AnalysisProgressStepper";
import { ExamplePatents } from "@/components/ExamplePatents";
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
  const [searchFocused, setSearchFocused] = useState(false);
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
      <Link to="/compare">
        <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-4 glossy-card gap-2 btn-press font-medium">
          <Heart className="w-3.5 h-3.5" />
          관심특허{favorites.length > 0 ? ` (${favorites.length})` : ""}
        </Button>
      </Link>
      {(summary || isLoading) && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { updateUrl(); reset(); }}
            className="rounded-full text-xs h-8 px-4 glossy-card btn-press font-medium"
          >
            새로운 검색
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { updateUrl(); reset(); clearHistory(); toast.success("검색 기록이 초기화되었습니다"); }}
            className="rounded-full text-xs h-8 px-4 glossy-card gap-1.5 btn-press font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            초기화
          </Button>
        </>
      )}
    </>
  );

  return (
    <PageLayout headerRight={headerRight}>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-14 relative z-10">
        {!summary && !isLoading ? (
          <>
            {/* 2026 Hero — mobile-first spacing */}
            <section className="text-center max-w-3xl mx-auto mb-12 md:mb-28 animate-fade-down relative py-8 md:py-20">
              <div className="absolute -inset-12 md:-inset-24 -z-10 overflow-hidden rounded-[2rem] md:rounded-[4rem]">
                <AiHeroAnimation />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] md:w-[650px] h-[300px] md:h-[400px] rounded-full -z-10 blur-[100px] md:blur-[140px] opacity-40 animate-float" style={{ background: 'radial-gradient(ellipse, hsl(158 64% 40% / 0.2), transparent 70%)' }} />

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl mb-6 md:mb-10 text-[11px] md:text-xs font-semibold border backdrop-blur-xl" style={{ background: 'hsl(158 64% 40% / 0.05)', color: 'hsl(158 64% 40%)', borderColor: 'hsl(158 64% 40% / 0.1)' }}>
                <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" />
                AI 기반 특허 분석
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-[3.75rem] font-extrabold text-foreground mb-4 md:mb-8 leading-[1.12] md:leading-[1.06] tracking-[-0.02em] md:tracking-[-0.03em] px-2">
                {settings.hero_title}<br />
                <span className="gradient-text gradient-shimmer">{settings.hero_title_accent}</span> {settings.hero_title_suffix}
              </h2>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg font-normal leading-relaxed max-w-xs sm:max-w-md mx-auto text-muted-foreground/70 tracking-tight px-4 md:px-0">
                {settings.hero_description}
              </p>
            </section>

            {/* Search */}
            <section className="mb-10 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <div className="w-full max-w-2xl mx-auto flex flex-col">
                <PatentInput onSubmit={handleSubmit} isLoading={isLoading} onKeywordSearch={handleKeywordSearch} placeholder={settings.search_placeholder} helperText={settings.search_helper_text} onFocusChange={setSearchFocused} />
                {homepageVisible.popularSearches !== false && (
                  <div className="relative">
                    <div className={`absolute left-0 right-0 top-0 z-20 transition-all duration-300 ease-in-out origin-top ${searchFocused ? 'opacity-100 scale-y-100 translate-y-0' : 'opacity-0 scale-y-95 -translate-y-2 pointer-events-none'}`}>
                      <div className="mt-2 rounded-2xl border border-border/40 bg-card/95 backdrop-blur-md p-4" style={{ boxShadow: 'var(--shadow-elevated)' }}>
                        <PopularSearches onPatentSelect={handleSubmit} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Example patents for new users */}
              {history.length === 0 && keywordResults.length === 0 && (
                <div className="w-full max-w-2xl mx-auto">
                  <ExamplePatents onSelect={handleSubmit} isLoading={isLoading} />
                </div>
              )}

              {history.length > 0 && keywordResults.length === 0 && (
                <div className="w-full max-w-5xl mx-auto mt-5">
                  <SearchHistory history={history} onSelect={handleHistorySelect} onRemove={removeFromHistory} onClear={clearHistory} />
                </div>
              )}
            </section>

            {homepageVisible.featuredPatents !== false && (
              <>
                <div className="max-w-5xl mx-auto mt-12 md:mt-16 mb-2">
                  <div className="section-divider" />
                </div>
                <FeaturedPatents
                  onPatentSelect={handleSubmit}
                  sectionTitle={settings.featured_section_title}
                  sectionSubtitle={settings.featured_section_subtitle}
                />
              </>
            )}

            {homepageVisible.techVideos !== false && (
              <>
                <div className="max-w-5xl mx-auto mt-12 md:mt-16 mb-2">
                  <div className="section-divider" />
                </div>
                <TechVideoSection videos={(() => {
                  try {
                    const parsed = JSON.parse(settings.tech_videos || "[]");
                    return Array.isArray(parsed) ? parsed : [];
                  } catch { return []; }
                })()} />
              </>
            )}

            {homepageVisible.techTransferGuide !== false && (
              <>
                <div className="max-w-5xl mx-auto mt-4 mb-2">
                  <div className="section-divider" />
                </div>
                <TechTransferGuide />
              </>
            )}
          </>
        ) : (
          <div ref={resultRef}>
            {/* Progress Stepper - shows during analysis */}
            {isLoading && (
              <AnalysisProgressStepper currentStep={analysisStep} />
            )}

            <section className="mb-8">
              <PatentSummary content={summary} patentNumber={currentPatent} isStreaming={isLoading} patentData={patentData} relatedPatents={relatedPatents} onRelatedPatentClick={handleSubmit} onKeywordClick={handleKeywordTagClick} onScoreReady={handleScoreReady} featureFlags={{ pdfEnabled: settings.feature_pdf !== "false", pptEnabled: settings.feature_ppt !== "false" }} />
            </section>

            {isLoading && !isFetching && (
              <section className="mt-12">
                <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
              </section>
            )}
          </div>
        )}
      </main>
    </PageLayout>
  );
};

export default Index;
