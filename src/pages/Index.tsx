import { Heart, RotateCcw, BarChart3, Layers, Compass, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { filingEnabled } from "@/lib/filing";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PatentInput } from "@/components/PatentInput";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import { useSearchHistory, SearchHistoryItem } from "@/hooks/useSearchHistory";
import { SearchHistory } from "@/components/SearchHistory";
import { Button } from "@/components/ui/button";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { FeaturedPatents } from "@/components/FeaturedPatents";
import { TechTransferGuide } from "@/components/TechTransferGuide";
import { TechVideoSection } from "@/components/TechVideoSection";
import { PopularSearches } from "@/components/PopularSearches";
import { HomeInsights } from "@/components/HomeInsights";
import { trackPatentSearch } from "@/hooks/useTrackSearch";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { AnalysisProgressStepper } from "@/components/AnalysisProgressStepper";
import { NoticeSection } from "@/components/NoticeSection";
import { PotentialTechBanner } from "@/components/PotentialTechBanner";
import { HomeSearchHero } from "@/components/HomeSearchHero";

import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// Result-only screens load on demand so the first home visit downloads less code.
const TossPatentSummary = lazy(() =>
  import("@/components/PatentSummary/TossPatentSummary").then((m) => ({ default: m.TossPatentSummary })),
);
const SatisfactionPanel = lazy(() =>
  import("@/components/SatisfactionPanel").then((m) => ({ default: m.SatisfactionPanel })),
);
const SummaryQuickNav = lazy(() =>
  import("@/components/SummaryQuickNav").then((m) => ({ default: m.SummaryQuickNav })),
);

const SummaryPlaceholder = () => (
  <div className="mb-8 min-h-[60vh] max-w-[864px] mx-auto rounded-3xl bg-muted/40 animate-pulse" aria-hidden="true" />
);

const Index = () => {
  const navigate = useNavigate();
  const {
    isLoading, isFetching, summary, currentPatent, patentData,
    relatedPatents, analysisStep, generateSummary,
    loadFromHistory, reset, summaryMeta
  } = usePatentSummary();
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  const { settings } = useSiteSettings();
  useDocumentTitle(summary || isLoading ? patentData?.titleKo || patentData?.title || currentPatent || "특허 요약" : null);
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

  // 헤더 메뉴: 데스크톱은 전부 펼치고, 좁은 화면은 주 메뉴 하나와 "메뉴" 드롭다운으로 접는다.
  // (아이콘 6개를 한 줄에 놓으면 390px 화면에서 뒤쪽 버튼이 잘려 눌리지 않았다.)
  const navItems: { to: string; label: string; title: string; icon: typeof Compass; badge?: string }[] = [
    { to: "/insights", label: "인사이트", title: "인사이트", icon: BarChart3 },
    { to: "/batch", label: "일괄조회·다운로드", title: "일괄조회·목록 다운로드: 번호 여러 건 조회 또는 조건별 목록을 엑셀·CSV로", icon: Layers },
    { to: "/compare", label: "관심특허", title: "관심특허", icon: Heart, badge: favorites.length > 0 ? `(${favorites.length})` : undefined },
  ];
  const resultActions = (summary || isLoading)
    ? [
        { key: "new", label: "새로운 검색", icon: undefined as typeof RotateCcw | undefined, onClick: () => { updateUrl(); reset(); } },
        { key: "reset", label: "초기화", icon: RotateCcw, onClick: () => { updateUrl(); reset(); clearHistory(); toast.success("검색 기록이 초기화되었습니다"); } },
      ]
    : [];
  const headerBtn = "rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium";

  const headerRight = (
    <>
      <Button asChild size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 gap-1 md:gap-2 btn-press font-semibold">
        <Link to="/finder" aria-label="나만의 특허찾기" title="나만의 특허찾기">
          <Compass className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">나만의 특허찾기</span>
        </Link>
      </Button>
      <div className="hidden sm:flex items-center gap-1.5 md:gap-2">
        {navItems.map(({ to, label, title, icon: Icon, badge }) => (
          <Button key={to} asChild variant="outline" size="sm" className={headerBtn}>
            <Link to={to} aria-label={badge ? `${label} ${badge}` : label} title={title}>
              <Icon className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>{label}</span>{badge ? ` ${badge}` : ""}
            </Link>
          </Button>
        ))}
        {resultActions.map(({ key, label, icon: Icon, onClick }) => (
          <Button key={key} variant="outline" size="sm" onClick={onClick} className={headerBtn}>
            {Icon && <RotateCcw className="w-3 h-3" />}
            {label}
          </Button>
        ))}
      </div>
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="메뉴 열기" variant="outline" size="sm" className={headerBtn}>
              <Menu className="w-3.5 h-3.5" />
              {favorites.length > 0 && <span className="text-[10px] font-semibold">{favorites.length}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {navItems.map(({ to, label, icon: Icon, badge }) => (
              <DropdownMenuItem key={to} asChild>
                <Link to={to} className="flex items-center gap-2 cursor-pointer">
                  <Icon className="w-4 h-4 text-primary" />
                  <span>{label}{badge ? ` ${badge}` : ""}</span>
                </Link>
              </DropdownMenuItem>
            ))}
            {resultActions.length > 0 && <DropdownMenuSeparator />}
            {resultActions.map(({ key, label, icon: Icon, onClick }) => (
              <DropdownMenuItem key={key} onSelect={onClick} className="flex items-center gap-2 cursor-pointer">
                {Icon ? <RotateCcw className="w-4 h-4 text-muted-foreground" /> : <span className="w-4" />}
                <span>{label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <PageLayout headerRight={headerRight}>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 relative z-10">
        {!summary && !isLoading ? (
          <>
            <HomeSearchHero
              showFiling={filingEnabled(settings)}
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

            {/* 특허 인사이트 — 출원 동향 + 주요 키워드 */}
            <section className="max-w-5xl mx-auto mb-5 md:mb-6 animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <HomeInsights />
            </section>

            {/* 세로 스크롤 단일 컬럼 — 공지·기록 → 추천특허 → 기술영상 → 기술이전 안내 */}
            <div className="max-w-5xl mx-auto space-y-6 md:space-y-7 animate-fade-up" style={{ animationDelay: "0.2s" }}>
              {(homepageVisible.notices !== false || homepageVisible.popularSearches !== false || (settings.feature_search_history !== "false" && history.length > 0)) && (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 home-support-section">
                  {homepageVisible.notices !== false && (
                    <div className="min-w-0">
                      <NoticeSection compact />
                    </div>
                  )}
                  {homepageVisible.popularSearches !== false && (
                    <div className="min-w-0">
                      <PopularSearches onPatentSelect={handleSubmit} />
                    </div>
                  )}
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
            {isLoading && (<AnalysisProgressStepper currentStep={analysisStep} floating />)}
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
            <Suspense fallback={<SummaryPlaceholder />}>
            {/* Until the patent record arrives the report has no title or basic-info block; showing it early made
                every section jump down when they appeared (layout shift), so a placeholder holds the space instead. */}
            {!patentData && isLoading ? <SummaryPlaceholder /> : (
            <section className="mb-8 flex justify-center items-start gap-4 xl:gap-5">
              {/* Side columns keep their width before their content is ready, so the report does not slide sideways (layout shift). */}
              <div className="hidden lg:block w-[196px] shrink-0 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <SummaryQuickNav
                  deps={`${currentPatent}-${summary.length}`}
                />
              </div>
              <div className="min-w-0 flex-1">
              <TossPatentSummary
                key={currentPatent}
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
                featureFlags={{ pdfEnabled: settings.feature_pdf !== "false" }}
                summaryMeta={summaryMeta}
              />
              <div className="lg:hidden mt-5 flex justify-center">
                <SatisfactionPanel patentNumber={currentPatent} className="w-full max-w-[864px]" />
              </div>
              </div>
              <div className="hidden lg:block w-[240px] shrink-0 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <SatisfactionPanel patentNumber={currentPatent}  />
              </div>
            </section>
            )}
            </Suspense>
          </div>
        )}
      </main>
    </PageLayout>
  );
};

export default Index;
