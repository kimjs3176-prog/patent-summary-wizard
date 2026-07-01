import { Heart, RotateCcw, BarChart3 } from "lucide-react";
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
import { HeroParticles } from "@/components/HeroParticles";

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
            {/* Deep Navy Hero */}
            <section className="relative -mx-3 sm:-mx-4 md:-mx-6 mb-10 md:mb-14 animate-fade-down rounded-none md:rounded-3xl">
              {/* Background layer: clipped to rounded corners */}
              <div className="absolute inset-0 overflow-hidden rounded-none md:rounded-3xl">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 60% at 80% 20%, hsl(158 64% 40% / 0.28), transparent 60%), radial-gradient(ellipse 60% 50% at 20% 80%, hsl(184 70% 45% / 0.18), transparent 60%), linear-gradient(135deg, #0a1628 0%, #0f2540 50%, #0a1a30 100%)",
                  }}
                />
                {/* Grid overlay */}
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage:
                      "linear-gradient(hsl(158 64% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(158 64% 60%) 1px, transparent 1px)",
                    backgroundSize: "48px 48px",
                    maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 80%)",
                  }}
                />
                {/* Glow blobs */}
                <div aria-hidden className="absolute -top-20 -right-10 w-72 h-72 rounded-full blur-3xl" style={{ background: "hsl(158 64% 45% / 0.35)" }} />
                <div aria-hidden className="absolute bottom-0 left-1/4 w-96 h-40 rounded-full blur-3xl" style={{ background: "hsl(184 70% 50% / 0.18)" }} />
                {/* Drift particles */}
                <HeroParticles />
              </div>

              <div className="relative px-5 sm:px-10 md:px-16 py-14 md:py-24">
                <div className="relative max-w-3xl mx-auto text-center">
                  <span className="inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold tracking-[0.18em] uppercase px-3 py-1 rounded-full mb-5 md:mb-7"
                    style={{ background: "hsl(158 64% 45% / 0.18)", color: "hsl(158 70% 75%)", border: "1px solid hsl(158 64% 45% / 0.35)" }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "hsl(158 70% 65%)" }} />
                    Agri-Food AI · Live Indexing
                  </span>

                  <h1 className="text-[32px] sm:text-5xl md:text-[60px] font-black leading-[1.05] tracking-[-0.035em] mb-5 md:mb-7" style={{ color: "#f5f9ff" }}>
                    농식품분야 특허&nbsp;
                    <br className="sm:hidden" />
                    <span
                      className="inline-block bg-clip-text text-transparent"
                      style={{ backgroundImage: "linear-gradient(135deg, hsl(158 70% 65%) 0%, hsl(184 80% 70%) 100%)" }}
                    >
                      AI 기술분석
                    </span>
                    &nbsp;서비스
                  </h1>

                  <p className="text-sm md:text-base mb-8 md:mb-10 leading-relaxed max-w-xl mx-auto" style={{ color: "hsl(210 30% 78%)" }}>
                    {settings.hero_description}
                  </p>

                  <div className="max-w-2xl mx-auto relative">
                    {/* Emerald glow ring around search */}
                    <div aria-hidden className="absolute -inset-1.5 rounded-full blur-xl opacity-70"
                      style={{ background: "linear-gradient(90deg, hsl(158 70% 50% / 0.6), hsl(184 80% 55% / 0.5))" }} />
                    <div className="relative bg-white rounded-2xl p-1.5" style={{ boxShadow: "0 20px 60px -10px hsl(158 64% 25% / 0.5), 0 0 0 1px hsl(158 64% 60% / 0.3)" }}>
                      <PatentInput
                        onSubmit={handleSubmit}
                        isLoading={isLoading}
                        onKeywordSearch={handleKeywordSearch}
                        placeholder={settings.search_placeholder}
                        helperText={settings.search_helper_text}
                        helperTexts={(() => { try { const t = JSON.parse(settings.search_helper_texts || "[]"); return Array.isArray(t) ? t.filter((s: string) => s.trim()) : []; } catch { return []; } })()}
                      />
                    </div>
                  </div>

                  {/* Trust strip */}
                  <div className="mt-8 md:mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] md:text-xs" style={{ color: "hsl(210 25% 70%)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full" style={{ background: "hsl(158 70% 60%)" }} />
                      6개 농업분야 국가연구기관 보유 특허&nbsp;
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full" style={{ background: "hsl(158 70% 60%)" }} />
                      KIPRIS 실시간 연동
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full" style={{ background: "hsl(158 70% 60%)" }} />
                      Gemini AI 분석
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 주제별 빠른 탐색 */}
            <section className="max-w-5xl mx-auto mb-10 md:mb-14 animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-end justify-between mb-4 md:mb-5">
                <h2 className="text-xl md:text-2xl font-black tracking-tight">
                  <span className="text-primary">§</span> 주제별 탐색
                </h2>
                <div className="flex-1 mx-4 h-px bg-foreground/20" />
                <span className="text-[10px] font-mono text-muted-foreground">/ INDEX</span>
              </div>
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
