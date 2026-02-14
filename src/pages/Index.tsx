import { FileText, Sparkles } from "lucide-react";
import { PatentInput } from "@/components/PatentInput";
import { PatentSummary } from "@/components/PatentSummary/index";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import { useSearchHistory, SearchHistoryItem } from "@/hooks/useSearchHistory";
import { SearchHistory } from "@/components/SearchHistory";
import { Button } from "@/components/ui/button";
import { KeywordSearchResults } from "@/components/KeywordSearchResults";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { RdaLatestPatents } from "@/components/RdaLatestPatents";
import { TechTransferGuide } from "@/components/TechTransferGuide";
import { PopularSearches } from "@/components/PopularSearches";
import { trackPatentSearch } from "@/hooks/useTrackSearch";
import { useState, useEffect, useRef } from "react";
const Index = () => {
  const {
    isLoading,
    isFetching,
    summary,
    currentPatent,
    patentData,
    relatedPatents,
    generateSummary,
    regenerateSummaryWithMode,
    loadFromHistory,
    reset
  } = usePatentSummary();
  const {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory
  } = useSearchHistory();

  // Keyword search state
  const [keywordResults, setKeywordResults] = useState<KeywordSearchResult[]>([]);
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const initialLoadDone = useRef(false);

  // Auto-search from URL param on first load
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const patentParam = params.get("patent");
    if (patentParam) {
      handleSubmitInternal(patentParam);
    }
  }, []);

  // Update URL when viewing a patent
  const updateUrl = (patentNum?: string) => {
    if (patentNum) {
      window.history.replaceState(null, "", `?patent=${encodeURIComponent(patentNum)}`);
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  // Internal submit handler
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
      // Track search for popular ranking
      trackPatentSearch(patentNumber, result.patentData.titleKo || result.patentData.title);
    }
  };

  // Handle patent search with history saving
  const handleSubmit = async (patentNumber: string) => {
    await handleSubmitInternal(patentNumber);
  };

  // Handle selecting from history
  const handleHistorySelect = (item: SearchHistoryItem) => {
    setKeywordResults([]);
    setSearchedKeyword("");
    updateUrl(item.patentNumber);
    loadFromHistory(item);
  };

  // Handle keyword search results
  const handleKeywordSearch = (results: KeywordSearchResult[], keyword: string) => {
    setKeywordResults(results);
    setSearchedKeyword(keyword);
  };

  // Handle selecting a patent from keyword search results
  const handleKeywordPatentSelect = (patentNumber: string) => {
    setKeywordResults([]);
    setSearchedKeyword("");
    handleSubmit(patentNumber);
  };

  // Clear keyword search results
  const handleClearKeywordResults = () => {
    setKeywordResults([]);
    setSearchedKeyword("");
  };
  return <div className="min-h-screen relative z-10">
      {/* Header */}
      <header className="w-full border-b border-border/40 bg-card/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm flex-shrink-0">
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm md:text-lg text-foreground truncate">농식품분야 특허 AI 기술요약 서비스</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Agri-Food Patent AI Summary Service</p>
            </div>
          </div>
          {(summary || isLoading) && <Button variant="outline" size="sm" onClick={() => { updateUrl(); reset(); }} className="border-border/50 bg-card/80 hover:bg-card text-foreground rounded-lg">
              새로운 특허 검색
            </Button>}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        {!summary && !isLoading ? <>
            {/* Hero Section with gradient banner */}
            <section className="text-center max-w-4xl mx-auto mb-8 md:mb-12 animate-fade-down">
              <div className="hero-gradient px-6 py-8 md:py-14 mb-8 md:mb-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsla(0,0%,100%,0.2),transparent_60%)]" />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-primary-foreground mb-5 md:mb-6 backdrop-blur-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-xs md:text-sm font-semibold">KIPRIS 특허 데이터 연동</span>
                  </div>
                  
                  <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-primary-foreground mb-4 md:mb-5 leading-[1.3] md:leading-tight tracking-tight">
                    농식품분야 특허<br />
                    AI 기술요약 서비스
                  </h2>
                  
                  <p className="text-sm md:text-lg text-primary-foreground/80 font-normal leading-relaxed max-w-lg mx-auto">
                    농식품 분야 특허를 AI가 자동으로 분석하고 요약합니다
                  </p>
                </div>
              </div>
            </section>

            {/* Input Section: 최근검색 - 검색창 - 인기검색 */}
            <section className="mb-6 animate-fade-up" style={{
          animationDelay: "0.15s"
        }}>
              <p className="text-center text-sm text-muted-foreground mb-5">
                기술 이전 받고 싶은 특허정보나 키워드를 입력하세요
              </p>
              <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-5 items-start justify-center">
                {/* 최근검색 (left) */}
                {history.length > 0 && keywordResults.length === 0 && (
                  <div className="w-full lg:w-auto lg:flex-shrink-0 order-1 lg:order-1">
                    <SearchHistory history={history} onSelect={handleHistorySelect} onRemove={removeFromHistory} onClear={clearHistory} />
                  </div>
                )}
                {/* 검색창 (center) */}
                <div className="w-full flex-1 max-w-2xl order-first lg:order-2 mx-auto">
                  <PatentInput onSubmit={handleSubmit} isLoading={isLoading} onKeywordSearch={handleKeywordSearch} />
                </div>
                {/* 인기검색 (right) */}
                <div className="w-full lg:w-auto lg:flex-shrink-0 order-3">
                  <PopularSearches onPatentSelect={handleSubmit} />
                </div>
              </div>
            </section>

            {/* Keyword Search Results Section */}
            {keywordResults.length > 0 && <section className="mb-12 animate-fade-up" style={{
          animationDelay: "0.25s"
        }}>
                <KeywordSearchResults results={keywordResults} keyword={searchedKeyword} onPatentSelect={handleKeywordPatentSelect} onClose={handleClearKeywordResults} isLoading={isLoading} />
              </section>}

            {/* RDA Latest Patents Section */}
            <RdaLatestPatents onPatentSelect={handleSubmit} />

            {/* Technology Transfer Guide Infographic */}
            <TechTransferGuide />
          </> : <>
            {/* Loading State */}
            {isFetching && <div className="text-center mb-8 animate-fade-up">
                <div className="inline-flex flex-col items-center gap-4 px-8 py-6 rounded-2xl glass-effect">
                  <div className="w-14 h-14 border-4 border-muted border-t-primary rounded-full animate-spin" />
                  <span className="text-muted-foreground font-medium">특허 정보를 불러오는 중...</span>
                </div>
              </div>}

            {/* Summary Section */}
            <section className="mb-8">
              <PatentSummary content={summary} patentNumber={currentPatent} isStreaming={isLoading} patentData={patentData} relatedPatents={relatedPatents} onRelatedPatentClick={handleSubmit} onAnalysisModeChange={regenerateSummaryWithMode} />
            </section>

            {/* Loading Input for new search during streaming */}
            {isLoading && !isFetching && <section className="mt-12">
                <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
              </section>}
          </>}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto relative z-10">
        <div className="container mx-auto px-4 py-4 md:py-6 text-center text-xs md:text-sm text-muted-foreground space-y-1">
          <p>본 서비스는 지식재산처/한국특허정보원의 공공데이터를 활용하여 제작되었습니다</p>
          <p>KIPRIS(한국특허정보원) 데이터 연동 • AI 기반 특허 분석</p>
        </div>
      </footer>
    </div>;
};
export default Index;