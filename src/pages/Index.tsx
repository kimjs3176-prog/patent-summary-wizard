import { Heart, RotateCcw } from "lucide-react";
import { AiHeroAnimation } from "@/components/AiHeroAnimation";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
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
    try {return settings.homepage_visible_sections ? JSON.parse(settings.homepage_visible_sections) : {};} catch {return {};}
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
            onClick={() => {updateUrl();reset();}}
            className="rounded-full text-xs h-8 px-4 glossy-card btn-press font-medium">
              새로운 검색
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {updateUrl();reset();clearHistory();toast.success("검색 기록이 초기화되었습니다");}}
            className="rounded-full text-xs h-8 px-4 glossy-card gap-1.5 btn-press font-medium">
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
            <section className="text-center max-w-2xl mx-auto mb-12 md:mb-16 animate-fade-down relative">
              <div className="absolute -inset-10 -z-10 overflow-hidden rounded-3xl">
                <AiHeroAnimation />
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-semibold" style={{ background: 'hsl(239 84% 67% / 0.08)', color: 'hsl(239 84% 50%)', border: '1px solid hsl(239 84% 67% / 0.15)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'hsl(239 84% 67%)' }} />
                AI 기반 특허 분석
              </div>
              <h2 className="text-3xl md:text-[2.75rem] lg:text-5xl font-extrabold text-foreground mb-4 md:mb-5 leading-[1.1] tracking-tight">
                {settings.hero_title}<br />
                <span className="gradient-text gradient-shimmer">{settings.hero_title_accent}</span> {settings.hero_title_suffix}
              </h2>
              <p className="text-sm md:text-base font-normal leading-relaxed max-w-lg mx-auto text-muted-foreground">
                {settings.hero_description}
              </p>
            </section>

            {/* Search */}
            <section className="mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <div className="w-full max-w-5xl mx-auto flex-col gap-5 lg:gap-6 items-center justify-center flex lg:flex-row">
                <div className="w-full flex-1 max-w-2xl mx-auto">
                  <PatentInput onSubmit={handleSubmit} isLoading={isLoading} onKeywordSearch={handleKeywordSearch} placeholder={settings.search_placeholder} helperText={settings.search_helper_text} />
                </div>
                {homepageVisible.popularSearches !== false && (
                  <div className="w-full lg:w-auto lg:flex-shrink-0">
                    <PopularSearches onPatentSelect={handleSubmit} />
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
              <FeaturedPatents
                onPatentSelect={handleSubmit}
                sectionTitle={settings.featured_section_title}
                sectionSubtitle={settings.featured_section_subtitle} />
            )}

            <div className="max-w-5xl mx-auto mt-10 md:mt-14 mb-2">
              <Separator className="bg-border/60" />
            </div>

            {homepageVisible.techVideos !== false && (
              <TechVideoSection videos={(() => {
                try {
                  const parsed = JSON.parse(settings.tech_videos || "[]");
                  return Array.isArray(parsed) ? parsed : [];
                } catch {return [];}
              })()} />
            )}

            {homepageVisible.techTransferGuide !== false && (
              <>
                <div className="max-w-5xl mx-auto mt-2 mb-2">
                  <Separator className="bg-border/60" />
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