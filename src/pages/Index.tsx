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
            {/* Editorial Hero */}
            <section className="max-w-5xl mx-auto mb-8 md:mb-12 animate-fade-down">
              <div className="border-y-2 border-foreground px-1 md:px-2 py-8 md:py-14">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <span className="text-[10px] md:text-[11px] font-black tracking-[0.2em] uppercase px-2 py-0.5 bg-primary/10 text-primary">
                    Technical Archive · 2026
                  </span>
                  <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    LIVE · AI Indexing
                  </div>
                </div>

                <h1 className="text-[36px] sm:text-5xl md:text-[68px] font-black leading-[1.02] tracking-[-0.04em] mb-6 md:mb-10">
                  농업 특허의<br />
                  <span className="italic font-serif text-primary">새로운 지평</span>을 열다
                </h1>

                <p className="text-xs md:text-sm text-muted-foreground/80 max-w-xl mb-7 md:mb-9 leading-relaxed">
                  {settings.hero_description}
                </p>

                <div className="max-w-2xl">
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

              {/* Metadata strip */}
              <div className="grid grid-cols-3 border-b-2 border-foreground divide-x-2 divide-foreground">
                <div className="px-3 md:px-5 py-3">
                  <div className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Coverage</div>
                  <div className="text-xs md:text-sm font-black tracking-tight">6개 농업기관</div>
                </div>
                <div className="px-3 md:px-5 py-3">
                  <div className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Engine</div>
                  <div className="text-xs md:text-sm font-black tracking-tight">Gemini · KIPRIS</div>
                </div>
                <div className="px-3 md:px-5 py-3">
                  <div className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Edition</div>
                  <div className="text-xs md:text-sm font-black tracking-tight font-mono">VOL. 2.4</div>
                </div>
              </div>
            </section>

            {/* 주제별 빠른 탐색 */}
            <section className="max-w-5xl mx-auto mb-10 md:mb-14 animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-end justify-between mb-4 md:mb-5">
                <h2 className="text-xl md:text-2xl font-black tracking-tight">
                  <span className="text-primary font-serif italic">§</span> 주제별 탐색
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
