import { Heart, RotateCcw, BarChart3, Home, Search, TrendingUp, Send, Sparkles } from "lucide-react";
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
      {/* Pastel mesh ambient background scoped to landing */}
      {!summary && !isLoading && (
        <div
          aria-hidden
          className="fixed inset-0 -z-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(at 0% 0%, hsl(232 100% 96%) 0px, transparent 55%), radial-gradient(at 100% 0%, hsl(300 100% 97%) 0px, transparent 55%), radial-gradient(at 100% 100%, hsl(198 100% 95%) 0px, transparent 55%), radial-gradient(at 0% 100%, hsl(232 100% 97%) 0px, transparent 55%)",
          }}
        />
      )}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 relative z-10">
        {!summary && !isLoading ? (
          <div className="flex gap-8 animate-fade-down">
            {/* In-page sidebar rail (desktop) */}
            <aside className="hidden lg:flex w-56 shrink-0 flex-col sticky top-24 self-start">
              <div className="rounded-3xl p-5 border border-white/60 bg-white/40 backdrop-blur-xl" style={{ boxShadow: "0 8px 30px -12px hsl(232 60% 40% / 0.12)" }}>
                <div className="flex items-center gap-2 mb-6 px-1">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md" style={{ background: "linear-gradient(135deg, hsl(232 80% 60%), hsl(260 75% 62%))" }}>A</div>
                  <span className="text-sm font-bold tracking-tight text-slate-800">Atipsum</span>
                </div>
                <nav className="space-y-1.5">
                  <a href="#" className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-semibold text-indigo-700 bg-white/80 shadow-sm ring-1 ring-indigo-100">
                    <Home className="w-4 h-4" /> 홈
                  </a>
                  <a href="#explorer" className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-500 hover:bg-white/60 transition-colors">
                    <Search className="w-4 h-4" /> 주제 탐색
                  </a>
                  <Link to="/insights" className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-500 hover:bg-white/60 transition-colors">
                    <TrendingUp className="w-4 h-4" /> 인사이트
                  </Link>
                  <a href="#tech-transfer" className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-slate-500 hover:bg-white/60 transition-colors">
                    <Send className="w-4 h-4" /> 기술이전
                  </a>
                </nav>
                <div className="mt-6 p-4 rounded-2xl border border-indigo-100/60" style={{ background: "linear-gradient(135deg, hsl(232 100% 97%), hsl(260 100% 98%))" }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <p className="text-[10px] font-bold tracking-widest uppercase text-indigo-500">AI Powered</p>
                  </div>
                  <p className="text-[12px] text-slate-700 leading-relaxed">Gemini 3.6 기반 요약 · 규제 분석 · 3축 사업화 평가</p>
                </div>
              </div>
            </aside>

            {/* Main content column */}
            <div className="flex-1 min-w-0">
              {/* Hero */}
              <section className="mb-10">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase px-3 py-1 rounded-full mb-4 bg-white/70 backdrop-blur border border-white/80 text-indigo-600 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-indigo-500" />
                  Agri-Food AI · Live Indexing
                </span>
                <h1 className="text-4xl md:text-[52px] font-bold leading-[1.08] tracking-[-0.02em] mb-4 text-slate-900">
                  농식품분야 특허의 미래를{" "}
                  <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(120deg, hsl(232 80% 55%) 0%, hsl(280 75% 60%) 55%, hsl(320 70% 60%) 100%)" }}>
                    AI로 발견하세요
                  </span>
                </h1>
                <p className="text-slate-500 text-base md:text-lg leading-relaxed mb-6 max-w-2xl">
                  {settings.hero_description}
                </p>

                {/* Floating pill search */}
                <div className="relative max-w-3xl group">
                  <div aria-hidden className="absolute -inset-2 rounded-[2rem] blur-2xl opacity-60 group-focus-within:opacity-90 transition-opacity" style={{ background: "linear-gradient(90deg, hsl(232 100% 85% / 0.6), hsl(280 100% 88% / 0.5), hsl(198 100% 85% / 0.5))" }} />
                  <div className="relative rounded-3xl bg-white/90 backdrop-blur-md p-2 ring-1 ring-white/80" style={{ boxShadow: "0 24px 60px -20px hsl(232 60% 40% / 0.25)" }}>
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

                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-slate-500">
                  {["6개 농업분야 국가연구기관 특허", "KIPRIS 실시간 연동", "Gemini AI 분석"].map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      {t}
                    </span>
                  ))}
                </div>
              </section>

              {/* Keyword Explorer card */}
              <section id="explorer" className="mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
                <div className="rounded-[2rem] bg-white/85 backdrop-blur-md p-6 md:p-8 border border-white/70" style={{ boxShadow: "0 12px 40px -20px hsl(232 60% 40% / 0.12)" }}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">주제별 탐색</h2>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Live Explorer</span>
                  </div>
                  <KeywordExplorer />
                </div>
              </section>

              {/* Notices + Popular + History row */}
              {(homepageVisible.notices !== false || (settings.feature_search_history !== "false" && history.length > 0)) && (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8 animate-fade-up" style={{ animationDelay: "0.15s" }}>
                  {homepageVisible.notices !== false && (
                    <div className="rounded-[2rem] bg-white/85 backdrop-blur-md p-5 border border-white/70 transition-all hover:-translate-y-0.5" style={{ boxShadow: "0 8px 30px -18px hsl(232 60% 40% / 0.15)" }}>
                      <NoticeSection compact />
                    </div>
                  )}
                  <div className="rounded-[2rem] bg-white/85 backdrop-blur-md p-5 border border-white/70 transition-all hover:-translate-y-0.5" style={{ boxShadow: "0 8px 30px -18px hsl(232 60% 40% / 0.15)" }}>
                    <PopularSearches onPatentSelect={handleSubmit} />
                  </div>
                  {settings.feature_search_history !== "false" && history.length > 0 && (
                    <div className="rounded-[2rem] bg-white/70 backdrop-blur-md p-5 border border-white/60 md:col-span-2">
                      <SearchHistory history={history} onSelect={handleHistorySelect} onRemove={removeFromHistory} onClear={clearHistory} />
                    </div>
                  )}
                </section>
              )}

              {/* Featured / Video / Transfer */}
              <div className="space-y-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
                {homepageVisible.featuredPatents !== false && (
                  <section className="rounded-[2rem] bg-white/85 backdrop-blur-md p-6 md:p-8 border border-white/70" style={{ boxShadow: "0 12px 40px -20px hsl(232 60% 40% / 0.12)" }}>
                    <FeaturedPatents
                      onPatentSelect={handleSubmit}
                      sectionTitle={settings.featured_section_title}
                      sectionSubtitle={settings.featured_section_subtitle}
                    />
                  </section>
                )}

                {homepageVisible.techVideos !== false && (
                  <section className="rounded-[2rem] bg-white/85 backdrop-blur-md p-6 md:p-8 border border-white/70" style={{ boxShadow: "0 12px 40px -20px hsl(232 60% 40% / 0.12)" }}>
                    <TechVideoSection videos={(() => {
                      try {
                        const parsed = JSON.parse(settings.tech_videos || "[]");
                        return Array.isArray(parsed) ? parsed : [];
                      } catch { return []; }
                    })()} />
                  </section>
                )}

                {homepageVisible.techTransferGuide !== false && (
                  <section id="tech-transfer" className="rounded-[2rem] p-6 md:p-8 text-white" style={{ background: "linear-gradient(135deg, hsl(232 80% 58%) 0%, hsl(260 70% 55%) 100%)", boxShadow: "0 24px 60px -20px hsl(232 60% 40% / 0.4)" }}>
                    <TechTransferGuide />
                  </section>
                )}
              </div>
            </div>
          </div>
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
