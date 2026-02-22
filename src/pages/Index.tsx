import { FileText, GitCompareArrows, Heart } from "lucide-react";
import { Link } from "react-router-dom";
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
import { useState, useEffect, useRef } from "react";

const Index = () => {
  const {
    isLoading, isFetching, summary, currentPatent, patentData,
    relatedPatents, generateSummary, regenerateSummaryWithMode,
    loadFromHistory, reset
  } = usePatentSummary();
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  const { settings } = useSiteSettings();
  const { favorites } = useFavoritePatents();

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
      {/* Ambient background blobs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[hsl(174_60%_90%/0.2)] blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[hsl(210_80%_92%/0.15)] blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[hsl(174_40%_85%/0.1)] blur-[80px]" />
      </div>

      {/* Header */}
      <header className="w-full bg-background/60 backdrop-blur-xl sticky top-0 z-50 border-b border-border/30">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center shadow-md">
              <FileText className="w-4.5 h-4.5 text-background" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm md:text-base text-foreground tracking-tight">
                {settings.header_title}
              </h1>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">
                {settings.header_subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/compare">
              <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-4 glossy-card gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                관심특허{favorites.length > 0 ? ` (${favorites.length})` : ""}
              </Button>
            </Link>
            {(summary || isLoading) &&
            <Button
              variant="outline"
              size="sm"
              onClick={() => {updateUrl();reset();}}
              className="rounded-full text-xs h-8 px-4 glossy-card">
                새로운 검색
              </Button>
            }
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-10 md:py-16 relative z-10">
        {!summary && !isLoading ?
        <>
            {/* Hero */}
            <section className="text-center max-w-3xl mx-auto mb-12 md:mb-16 animate-fade-down">
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 md:mb-5 leading-[1.15] tracking-tight">
                {settings.hero_title}<br />
                <span className="gradient-text">{settings.hero_title_accent}</span> {settings.hero_title_suffix}
              </h2>
              <p className="md:text-lg text-muted-foreground font-normal leading-relaxed max-w-md mx-auto text-sm">
                {settings.hero_description}
              </p>
            </section>

            {/* Search Section */}
            <section className="mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <div className="w-full max-w-5xl mx-auto flex-col gap-5 lg:gap-6 items-center justify-center flex lg:flex-row">
                <div className="w-full flex-1 max-w-2xl mx-auto">
                  <PatentInput onSubmit={handleSubmit} isLoading={isLoading} onKeywordSearch={handleKeywordSearch} />
                </div>
                <div className="w-full lg:w-auto lg:flex-shrink-0">
                  <PopularSearches onPatentSelect={handleSubmit} />
                </div>
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

            <FeaturedPatents
            onPatentSelect={handleSubmit}
            sectionTitle={settings.featured_section_title}
            sectionSubtitle={settings.featured_section_subtitle} />

            <div className="max-w-5xl mx-auto mt-10 md:mt-14 mb-2">
              <Separator className="bg-border/60" />
            </div>

            <TechVideoSection videos={(() => {
            try {
              const parsed = JSON.parse(settings.tech_videos || "[]");
              return Array.isArray(parsed) ? parsed : [];
            } catch {return [];}
          })()} />

            <div className="max-w-5xl mx-auto mt-2 mb-2">
              <Separator className="bg-border/60" />
            </div>

            <TechTransferGuide />
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
              <PatentSummary content={summary} patentNumber={currentPatent} isStreaming={isLoading} patentData={patentData} relatedPatents={relatedPatents} onRelatedPatentClick={handleSubmit} onAnalysisModeChange={regenerateSummaryWithMode} />
            </section>

            {isLoading && !isFetching &&
          <section className="mt-12">
                <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
              </section>
          }
          </>
        }
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-auto relative z-10">
        <div className="container mx-auto px-4 py-6 md:py-8 text-center text-xs text-muted-foreground space-y-1">
          <p>{settings.footer_line1}</p>
          <p>{settings.footer_line2}</p>
        </div>
      </footer>
    </div>);

};

export default Index;