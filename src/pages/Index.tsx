import { Heart, RotateCcw, BarChart3, Layers } from "lucide-react";
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
        <Button variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
          <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">인사이트</span>
        </Button>
      </Link>
      <Link to="/batch">
        <Button variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1 md:gap-2 btn-press font-medium">
          <Layers className="w-3 h-3 md:w-3.5 md:h-3.5" />
          <span className="hidden sm:inline">일괄조회</span>
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
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 relative z-10">
        {!summary && !isLoading ? (
          <>
            {/* ── Mobile: 검색 중심의 간결한 레이아웃 ───────────────── */}
            {isMobile ? (
              <section className="-mx-3 sm:-mx-4 mb-5 animate-fade-down">
                <div className="relative overflow-hidden px-5 pt-7 pb-6" style={{ background: "linear-gradient(180deg, #0a1727 0%, #0c1d31 100%)" }}>
                  <div aria-hidden className="blueprint-grid absolute inset-0 opacity-60" />
                  <div className="relative">
                    <span className="font-mono text-[9.5px] tracking-[0.22em] uppercase" style={{ color: "hsl(158 55% 62%)" }}>
                      AGRI-FOOD PATENT AI
                    </span>
                    <h1 className="mt-2 text-[26px] font-black leading-[1.12] tracking-[-0.035em]" style={{ color: "#eef4fb" }}>
                      Agri IP <span style={{ color: "hsl(158 62% 60%)" }}>Summary</span>
                    </h1>
                    <p className="mt-1.5 text-[13px] font-medium" style={{ color: "hsl(158 62% 72%)" }}>
                      농업기술 특허를 한눈에, AI로 쉽게
                    </p>

                    <div className="mt-4 rounded-xl bg-white p-1.5" style={{ boxShadow: "0 14px 30px -16px hsl(218 60% 4% / 0.85)" }}>
                      <PatentInput
                        onSubmit={handleSubmit}
                        isLoading={isLoading}
                        onKeywordSearch={handleKeywordSearch}
                        placeholder={settings.search_placeholder}
                      />
                    </div>
                  </div>
                </div>
              </section>
            ) : (
            <section className="blueprint-hero relative -mx-3 sm:-mx-4 md:-mx-6 mb-6 md:mb-9 animate-fade-down rounded-none md:rounded-2xl">
              <div className="absolute inset-0 overflow-hidden rounded-none md:rounded-2xl">
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #0a1727 0%, #0c1d31 100%)" }} />
                <div aria-hidden className="blueprint-grid absolute inset-0" />
                <div aria-hidden className="blueprint-sweep" />
                {/* corner registration marks */}
                <div aria-hidden className="bp-mark bp-mark-tl" />
                <div aria-hidden className="bp-mark bp-mark-tr" />
                <div aria-hidden className="bp-mark bp-mark-bl" />
                <div aria-hidden className="bp-mark bp-mark-br" />
              </div>

              <div className="relative px-5 sm:px-10 md:px-14 py-9 md:py-14">
                <div className="relative max-w-3xl mx-auto">
                  {/* Draft slug line */}
                  <div className="flex items-center gap-3 mb-5 md:mb-7">
                    <span className="font-mono text-[10px] md:text-[11px] tracking-[0.22em] uppercase" style={{ color: "hsl(158 55% 62%)" }}>
                      DOC / AGRI-FOOD PATENT ANALYSIS
                    </span>
                    <div className="flex-1 h-px" style={{ background: "hsl(200 40% 70% / 0.18)" }} />
                    <span className="font-mono text-[10px] md:text-[11px] tracking-[0.16em]" style={{ color: "hsl(205 25% 58%)" }}>
                      REV. 2026
                    </span>
                  </div>

                  <h1 className="text-[30px] sm:text-[44px] md:text-[54px] font-black leading-[1.08] tracking-[-0.04em] mb-2 md:mb-3" style={{ color: "#eef4fb" }}>
                    Agri IP
                    <br />
                    <span className="relative inline-block">
                      <span style={{ color: "hsl(158 62% 60%)" }}>Summary</span>
                      <span aria-hidden className="absolute left-0 -bottom-1 w-full h-px" style={{ background: "hsl(158 62% 60% / 0.5)" }} />
                    </span>
                    <span className="inline-block ml-1.5" aria-label="AIS">
                      <span style={{ color: "#eef4fb" }}>(</span>
                      {"AIS".split("").map((c, i) => (
                        <span
                          key={`ais-${i}`}
                          className="inline-block animate-fade-in"
                          style={{
                            color: "hsl(158 62% 60%)",
                            textShadow: "0 0 18px hsl(158 62% 60% / 0.45), 0 0 36px hsl(158 62% 60% / 0.25)",
                            animationDelay: `${0.5 + i * 0.1}s`,
                            animationFillMode: "both",
                          }}
                        >
                          {c}
                        </span>
                      ))}
                      <span style={{ color: "#eef4fb" }}>)</span>
                    </span>
                  </h1>

                  <p className="text-base md:text-lg font-medium tracking-tight mb-4 md:mb-6" style={{ color: "hsl(158 62% 72%)" }}>
                    농업기술 특허를 한눈에, AI로 쉽게
                  </p>

                  <p className="text-sm md:text-[15px] mb-6 md:mb-8 leading-relaxed max-w-xl" style={{ color: "hsl(205 22% 72%)" }}>
                    {settings.hero_description}
                  </p>

                  <div className="max-w-2xl">
                    <div className="relative bg-white rounded-xl p-1.5" style={{ boxShadow: "0 18px 40px -18px hsl(218 60% 4% / 0.8), 0 0 0 1px hsl(200 30% 70% / 0.25)" }}>
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

                  {/* Spec strip — tabulated, monospace */}
                  <dl className="mt-6 md:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-px rounded-lg overflow-hidden" style={{ background: "hsl(200 40% 70% / 0.14)" }}>
                    {[
                      { k: "SOURCE", v: "농업분야 국가연구기관 보유 특허" },
                      { k: "SYNC", v: "KIPRIS 실시간 연동" },
                      { k: "ENGINE", v: "Gemini AI 분석" },
                    ].map((it) => (
                      <div key={it.k} className="px-3.5 py-3" style={{ background: "hsl(213 45% 11%)" }}>
                        <dt className="font-mono text-[9.5px] tracking-[0.2em]" style={{ color: "hsl(158 45% 58%)" }}>{it.k}</dt>
                        <dd className="text-[12px] md:text-[12.5px] mt-1 leading-snug" style={{ color: "hsl(205 25% 78%)" }}>{it.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </section>
            )}

            {/* 주제별 빠른 탐색 */}
            <section className="max-w-5xl mx-auto mb-5 md:mb-9 animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <div className="hidden md:flex items-end justify-between mb-2.5 md:mb-4">
                <h2 className="text-[15px] md:text-2xl font-black tracking-tight">
                  <span className="text-primary">§</span> 주제별 탐색
                </h2>
                <div className="flex-1 mx-3 md:mx-4 h-px bg-foreground/15 md:bg-foreground/20" />
                <span className="hidden md:inline text-[10px] font-mono text-muted-foreground">/ INDEX</span>
              </div>
              <KeywordExplorer />
            </section>

            {/* 세로 스크롤 단일 컬럼 — 공지·기록 → 추천특허 → 기술영상 → 기술이전 안내 */}
            <div className="max-w-5xl mx-auto space-y-5 md:space-y-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
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

              {isMobile && !mobileMoreOpen && (homepageVisible.techVideos !== false || homepageVisible.techTransferGuide !== false) && (
                <button
                  type="button"
                  onClick={() => setMobileMoreOpen(true)}
                  className="w-full rounded-2xl border border-border/50 bg-card py-3 text-[13px] font-semibold text-muted-foreground inline-flex items-center justify-center gap-1.5 btn-press"
                >
                  기술영상 · 기술이전 안내 더보기
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}

              {(!isMobile || mobileMoreOpen) && homepageVisible.techVideos !== false && (
                <section>
                  <TechVideoSection videos={(() => {
                    try {
                      const parsed = JSON.parse(settings.tech_videos || "[]");
                      return Array.isArray(parsed) ? parsed : [];
                    } catch { return []; }
                  })()} />
                </section>
              )}

              {(!isMobile || mobileMoreOpen) && homepageVisible.techTransferGuide !== false && (
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
