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
import { useState, useEffect, useRef, useMemo } from "react";
import { PageLayout } from "@/components/layout/PageLayout";

const Index = () => {
  const navigate = useNavigate();
  const {
    isLoading, isFetching, summary, currentPatent, patentData,
    relatedPatents, generateSummary,
    loadFromHistory, reset
  } = usePatentSummary();
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  const { settings } = useSiteSettings();
  const { favorites } = useFavoritePatents();

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
      <main className="container mx-auto px-4 md:px-6 py-8 md:py-14 relative z-10">
        {!summary && !isLoading ? (
          <>
            {/* Hero */}
            <section className="text-center max-w-3xl mx-auto mb-16 md:mb-24 animate-fade-down relative py-10 md:py-16">
              {/* Neural network animation background */}
              <div className="absolute -inset-20 -z-10 overflow-hidden rounded-[3rem]">
                <AiHeroAnimation />
              </div>
              {/* Radial glow behind heading */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] rounded-full -z-10 blur-[120px] opacity-50" style={{ background: 'radial-gradient(ellipse, hsl(152 76% 36% / 0.25), transparent 70%)' }} />

              <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full mb-8 text-xs font-semibold border shadow-sm backdrop-blur-md" style={{ background: 'hsl(152 76% 36% / 0.06)', color: 'hsl(152 76% 36%)', borderColor: 'hsl(152 76% 36% / 0.12)' }}>
                <Sparkles className="w-3.5 h-3.5" />
                AI 기반 특허 분석
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold text-foreground mb-6 md:mb-7 leading-[1.08] tracking-tight">
                {settings.hero_title}<br />
                <span className="gradient-text gradient-shimmer">{settings.hero_title_accent}</span> {settings.hero_title_suffix}
              </h2>
              <p className="text-sm md:text-base lg:text-lg font-normal leading-relaxed max-w-lg mx-auto text-muted-foreground">
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
          <>
            {isFetching && (
              <div className="text-center mb-8 animate-fade-up">
                <div className="inline-flex flex-col items-center gap-4 px-8 py-8 rounded-2xl bg-secondary">
                  <div className="w-10 h-10 border-3 border-muted-foreground/20 border-t-foreground rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">특허 정보를 불러오는 중...</span>
                </div>
              </div>
            )}

            <section className="mb-8">
              <PatentSummary content={summary} patentNumber={currentPatent} isStreaming={isLoading} patentData={patentData} relatedPatents={relatedPatents} onRelatedPatentClick={handleSubmit} onKeywordClick={handleKeywordTagClick} featureFlags={{ pdfEnabled: settings.feature_pdf !== "false", pptEnabled: settings.feature_ppt !== "false" }} />
            </section>

            {isLoading && !isFetching && (
              <section className="mt-12">
                <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
              </section>
            )}
          </>
        )}
      </main>
    </PageLayout>
  );
};

export default Index;
