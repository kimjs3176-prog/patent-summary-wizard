import { FileText, GitCompareArrows, Heart, RotateCcw } from "lucide-react";
import { AiHeroAnimation } from "@/components/AiHeroAnimation";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { PatentInput } from "@/components/PatentInput";
import { PatentSummary } from "@/components/PatentSummary/index";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import { useSearchHistory, SearchHistoryItem } from "@/hooks/useSearchHistory";
import { SearchHistory } from "@/components/SearchHistory";
import { Button } from "@/components/ui/button";
import { KeywordSearchResults } from "@/components/KeywordSearchResults";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { FeaturedPatents } from "@/components/FeaturedPatents";
import { TechTransferGuide } from "@/components/TechTransferGuide";
import { TechVideoSection } from "@/components/TechVideoSection";
import { PopularSearches } from "@/components/PopularSearches";
import { trackPatentSearch } from "@/hooks/useTrackSearch";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { useState, useEffect, useRef, useMemo } from "react";

const Index = () => {
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

  const [keywordResults, setKeywordResults] = useState<KeywordSearchResult[]>([]);
  const [searchedKeyword, setSearchedKeyword] = useState("");

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const patentParam = params.get("patent");
    if (patentParam) handleSubmitInternal(patentParam);
  }, []);

  const updateUrl = (patentNum?: string) => {
    if (patentNum) {
      window.history.replaceState(null, "", `?patent=${encodeURIComponent(patentNum)}`);
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  const handleSubmitInternal = async (patentNumber: string) => {
    setKeywordResults([]);
    setSearchedKeyword("");
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

  const handleSubmit = async (patentNumber: string) => {
    await handleSubmitInternal(patentNumber);
  };

  const handleHistorySelect = (item: SearchHistoryItem) => {
    setKeywordResults([]);
    setSearchedKeyword("");
    updateUrl(item.patentNumber);
    loadFromHistory(item);
  };

  const handleKeywordSearch = (results: KeywordSearchResult[], keyword: string) => {
    setKeywordResults(results);
    setSearchedKeyword(keyword);
  };

  const handleKeywordTagClick = async (keyword: string) => {
    try {
      toast.info(`"${keyword}" 관련 특허를 검색 중...`);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-patents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ keyword }),
        }
      );
      const result = await response.json();
      if (result.success && result.patents) {
        handleKeywordSearch(result.patents, keyword);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (result.patents.length === 0) toast.info("검색 결과가 없습니다.");
      } else {
        toast.error(result.error || "검색에 실패했습니다.");
      }
    } catch {
      toast.error("검색 중 오류가 발생했습니다.");
    }
  };

  const handleKeywordPatentSelect = (patentNumber: string) => {
    setKeywordResults([]);
    setSearchedKeyword("");
    handleSubmit(patentNumber);
  };

  const handleClearKeywordResults = () => {
    setKeywordResults([]);
    setSearchedKeyword("");
  };



  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* 2025 Ambient background — Soft indigo/violet gradient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[140px]" style={{ background: 'radial-gradient(circle, hsl(239 84% 67% / 0.12) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-[550px] h-[550px] rounded-full blur-[140px]" style={{ background: 'radial-gradient(circle, hsl(280 68% 56% / 0.08) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, hsl(262 83% 58% / 0.06) 0%, transparent 60%)' }} />
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'linear-gradient(hsl(220 13% 91%) 1px, transparent 1px), linear-gradient(90deg, hsl(220 13% 91%) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      </div>

      {/* Header — Refined glass morphism */}
      <header className="w-full sticky top-0 z-50 backdrop-blur-2xl border-b" style={{ background: 'hsl(0 0% 100% / 0.85)', borderColor: 'hsl(220 13% 91% / 0.6)' }}>
        <div className="container mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo with gradient accent */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md icon-bounce cursor-pointer" style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))' }}>
              <FileText className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-foreground tracking-tight leading-tight">
                {settings.header_title}
              </h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block leading-tight">
                {settings.header_subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/compare">
              <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-4 glossy-card gap-2 btn-press font-medium">
                <Heart className="w-3.5 h-3.5" />
                관심특허{favorites.length > 0 ? ` (${favorites.length})` : ""}
              </Button>
            </Link>
            {(summary || isLoading) &&
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
            }
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 md:py-14 relative z-10">
        {!summary && !isLoading ?
        <>
            {/* Hero — 2025 Bold Typography */}
            <section className="text-center max-w-2xl mx-auto mb-12 md:mb-16 animate-fade-down relative">
              {/* AI Neural Network Animation Background */}
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

            {/* Search Section */}
            <section className="mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <div className="w-full max-w-5xl mx-auto flex-col gap-5 lg:gap-6 items-center justify-center flex lg:flex-row">
                <div className="w-full flex-1 max-w-2xl mx-auto">
                  <PatentInput onSubmit={handleSubmit} isLoading={isLoading} onKeywordSearch={handleKeywordSearch} placeholder={settings.search_placeholder} helperText={settings.search_helper_text} />
                </div>
                {homepageVisible.popularSearches !== false &&
              <div className="w-full lg:w-auto lg:flex-shrink-0">
                    <PopularSearches onPatentSelect={handleSubmit} />
                  </div>
              }
              </div>
              {history.length > 0 && keywordResults.length === 0 &&
            <div className="w-full max-w-5xl mx-auto mt-5">
                  <SearchHistory history={history} onSelect={handleHistorySelect} onRemove={removeFromHistory} onClear={clearHistory} />
                </div>
            }
            </section>

            {/* Keyword Results */}
            {keywordResults.length > 0 &&
          <section className="mb-12 animate-fade-up" style={{ animationDelay: "0.2s" }}>
                <KeywordSearchResults results={keywordResults} keyword={searchedKeyword} onPatentSelect={handleKeywordPatentSelect} onClose={handleClearKeywordResults} isLoading={isLoading} />
              </section>
          }

            {homepageVisible.featuredPatents !== false &&
          <FeaturedPatents
            onPatentSelect={handleSubmit}
            sectionTitle={settings.featured_section_title}
            sectionSubtitle={settings.featured_section_subtitle} />
          }

            <div className="max-w-5xl mx-auto mt-10 md:mt-14 mb-2">
              <Separator className="bg-border/60" />
            </div>

            {homepageVisible.techVideos !== false &&
          <TechVideoSection videos={(() => {
            try {
              const parsed = JSON.parse(settings.tech_videos || "[]");
              return Array.isArray(parsed) ? parsed : [];
            } catch {return [];}
          })()} />
          }

            {homepageVisible.techTransferGuide !== false &&
          <>
                <div className="max-w-5xl mx-auto mt-2 mb-2">
                  <Separator className="bg-border/60" />
                </div>
                <TechTransferGuide />
              </>
          }
          </> :

        <>
            {isFetching &&
          <div className="text-center mb-8 animate-fade-up">
                <div className="inline-flex flex-col items-center gap-4 px-8 py-8 rounded-2xl bg-secondary">
                  <div className="w-10 h-10 border-3 border-muted-foreground/20 border-t-foreground rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">특허 정보를 불러오는 중...</span>
                </div>
              </div>
          }

            <section className="mb-8">
              <PatentSummary content={summary} patentNumber={currentPatent} isStreaming={isLoading} patentData={patentData} relatedPatents={relatedPatents} onRelatedPatentClick={handleSubmit} onKeywordClick={handleKeywordTagClick} featureFlags={{ pdfEnabled: settings.feature_pdf !== "false", pptEnabled: settings.feature_ppt !== "false" }} />
            </section>

            {isLoading && !isFetching &&
          <section className="mt-12">
                <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
              </section>
          }
          </>
        }
      </main>

      {/* Footer — Clean modern style */}
      <footer className="mt-auto relative z-10" style={{ borderTop: '1px solid hsl(220 13% 91% / 0.6)' }}>
        <div className="container mx-auto px-4 py-8 md:py-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))' }}>
              <FileText className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-foreground">{settings.header_title}</span>
          </div>
          <p className="text-xs text-muted-foreground">{settings.footer_line1}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{settings.footer_line2}</p>
        </div>
      </footer>
    </div>);

};

export default Index;