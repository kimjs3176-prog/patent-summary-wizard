import { Heart, RotateCcw, BarChart3, Layers, FileSpreadsheet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PatentInput } from "@/components/PatentInput";
import { TossPatentSummary } from "@/components/PatentSummary/TossPatentSummary";
import { SatisfactionPanel } from "@/components/SatisfactionPanel";
import { SummaryQuickNav } from "@/components/SummaryQuickNav";
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
import { PotentialTechBanner } from "@/components/PotentialTechBanner";
import { HomeSearchHero } from "@/components/HomeSearchHero";

import { useState, useEffect, useRef, useMemo } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown } from "lucide-react";

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
  const isMobile = useIsMobile();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

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
        <Button aria-label="인사이트" title="인사이트" variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
          <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">인사이트</span>
        </Button>
      </Link>
      <Link to="/batch">
        <Button aria-label="일괄조회" title="일괄조회" variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
          <Layers className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">일괄조회</span>
        </Button>
      </Link>
      <Link to="/export">
        <Button aria-label="목록 다운로드" title="목록 다운로드" variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
          <FileSpreadsheet className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">목록 다운로드</span>
        </Button>
      </Link>
      <Link to="/compare">
        <Button aria-label="관심특허" title="관심특허" variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
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
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 relative z-10">
        {!summary && !isLoading ? (
          <>
            <HomeSearchHero
              onSubmit={handleSubmit}
              onKeywordSearch={handleKeywordSearch}
              isLoading={isLoading}
              description={settings.hero_description}
              placeholder={settings.search_placeholder}
            />

            {/* 잠재기술 무상기술이전 배너 */}
            <section className="max-w-5xl mx-auto mb-5 md:mb-6 animate-fade-up" style={{ animationDelay: "0.12s" }}>
              <PotentialTechBanner />
            </section>

            {/* 주제별 빠른 탐색 */}
            <section className="max-w-5xl mx-auto mb-5 md:mb-6 animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <KeywordExplorer />
            </section>

            {/* 세로 스크롤 단일 컬럼 — 공지·기록 → 추천특허 → 기술영상 → 기술이전 안내 */}
            <div className="max-w-5xl mx-auto space-y-6 md:space-y-7 animate-fade-up" style={{ animationDelay: "0.2s" }}>
              {(homepageVisible.notices !== false || (settings.feature_search_history !== "false" && history.length > 0)) && (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 home-support-section">
                  {homepageVisible.notices !== false && (
                    <div className="min-w-0">
                      <NoticeSection compact />
                    </div>
                  )}
                  <div className="min-w-0">
                    <PopularSearches onPatentSelect={handleSubmit} />
                  </div>
                  {settings.feature_search_history !== "false" && history.length > 0 && (
                    <div className="min-w-0 border-t border-border pt-5 md:col-span-2">
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

              {isMobile && !mobileMoreOpen && (homepageVisible.techVideos !== false || homepageVisible.techTransferGuide !== false) && (
                <Button
                  variant="outline"
                  onClick={() => setMobileMoreOpen(true)}
                  className="w-full rounded-2xl border border-border/50 bg-card py-3 text-[13px] font-semibold text-muted-foreground inline-flex items-center justify-center gap-1.5 btn-press"
                >
                  기술영상 · 기술이전 안내 더보기
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              )}

              {(!isMobile || mobileMoreOpen) && homepageVisible.techVideos !== false && (
                <section className="home-support-section">
                  <TechVideoSection videos={(() => {
                    try {
                      const parsed = JSON.parse(settings.tech_videos || "[]");
                      return Array.isArray(parsed) ? parsed : [];
                    } catch { return []; }
                  })()} />
                </section>
              )}

              {(!isMobile || mobileMoreOpen) && homepageVisible.techTransferGuide !== false && (
                <section id="tech-transfer" className="home-support-section">
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
            <section className="mb-8 flex justify-center items-start gap-4 xl:gap-5">
              <div className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <SummaryQuickNav
                  deps={`${currentPatent}-${summary.length}`}
                />
              </div>
              <div className="min-w-0 flex-1">
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
              <div className="lg:hidden mt-5 flex justify-center">
                <SatisfactionPanel patentNumber={currentPatent} className="w-full max-w-[864px]" />
              </div>
              </div>
              <div className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <SatisfactionPanel patentNumber={currentPatent}  />
              </div>
            </section>
          </div>
        )}
      </main>
    </PageLayout>
  );
};

export default Index;
