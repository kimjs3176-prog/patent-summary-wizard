import { FileText, Search, Sparkles } from "lucide-react";
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
    isLoading, isFetching, summary, currentPatent, patentData,
    relatedPatents, generateSummary, regenerateSummaryWithMode,
    loadFromHistory, reset
  } = usePatentSummary();
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="w-full bg-background/80 backdrop-blur-xl sticky top-0 z-50 border-b border-border/50">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-background" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm md:text-base text-foreground tracking-tight">
                농식품분야 특허 AI 기술요약
              </h1>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">
                Agri-Food Patent AI Summary
              </p>
            </div>
          </div>
          {(summary || isLoading) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { updateUrl(); reset(); }}
              className="rounded-full text-xs h-8 px-4"
            >
              새로운 검색
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        {!summary && !isLoading ? (
          <>
            {/* Bento Grid Layout */}
            <div className="max-w-6xl mx-auto">
              {/* Row 1: Hero (left, tall) + Search (right) */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5 mb-4 md:mb-5">
                {/* Hero - spans 2 cols */}
                <div className="lg:col-span-2 bento-card bg-foreground text-background p-8 md:p-10 flex flex-col justify-between min-h-[280px] animate-fade-up">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/10 text-xs font-medium mb-6">
                      <Sparkles className="w-3 h-3" />
                      AI 기반 특허 분석
                    </div>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-[1.15] tracking-tight mb-4">
                      농식품분야 특허<br />
                      AI 기술요약<br />
                      서비스
                    </h2>
                  </div>
                  <p className="text-sm text-background/60 leading-relaxed">
                    농식품 분야 특허를 AI가 자동으로<br className="hidden md:block" />
                    분석하고 요약합니다
                  </p>
                </div>

                {/* Search Card - spans 3 cols */}
                <div className="lg:col-span-3 bento-card bg-secondary/30 p-6 md:p-8 flex flex-col justify-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
                  <div className="flex items-center gap-2 mb-5">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">특허 검색</span>
                  </div>
                  <PatentInput onSubmit={handleSubmit} isLoading={isLoading} onKeywordSearch={handleKeywordSearch} />
                </div>
              </div>

              {/* Keyword Results */}
              {keywordResults.length > 0 && (
                <div className="mb-4 md:mb-5 animate-fade-up">
                  <KeywordSearchResults results={keywordResults} keyword={searchedKeyword} onPatentSelect={handleKeywordPatentSelect} onClose={handleClearKeywordResults} isLoading={isLoading} />
                </div>
              )}

              {/* Row 2: Recent + Popular + Feature card */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-4 md:mb-5">
                {/* Recent Searches */}
                {history.length > 0 && keywordResults.length === 0 && (
                  <div className="bento-card bg-secondary/30 p-0 animate-fade-up" style={{ animationDelay: "0.1s" }}>
                    <SearchHistory history={history} onSelect={handleHistorySelect} onRemove={removeFromHistory} onClear={clearHistory} />
                  </div>
                )}

                {/* Popular Searches */}
                <div className="bento-card bg-secondary/30 p-0 animate-fade-up" style={{ animationDelay: "0.15s" }}>
                  <PopularSearches onPatentSelect={handleSubmit} />
                </div>

                {/* Info Card */}
                <div className="bento-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/10 p-6 md:p-8 flex flex-col justify-between animate-fade-up" style={{ animationDelay: "0.2s" }}>
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">특허번호로 바로 검색</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      등록번호(10-XXXXXXX) 또는 출원번호를 입력하면 AI가 자동으로 특허를 분석하고 기술요약을 생성합니다.
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["10-2920574", "10-2887680"].map((num) => (
                      <button
                        key={num}
                        onClick={() => handleSubmit(num)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: RDA Latest Patents (full width bento) */}
              <div className="bento-card bg-secondary/30 p-0 mb-4 md:mb-5 animate-fade-up" style={{ animationDelay: "0.25s" }}>
                <RdaLatestPatents onPatentSelect={handleSubmit} />
              </div>

              {/* Row 4: Tech Transfer Guide (full width bento) */}
              <div className="bento-card bg-secondary/30 p-0 animate-fade-up" style={{ animationDelay: "0.3s" }}>
                <TechTransferGuide />
              </div>
            </div>
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
              <PatentSummary content={summary} patentNumber={currentPatent} isStreaming={isLoading} patentData={patentData} relatedPatents={relatedPatents} onRelatedPatentClick={handleSubmit} onAnalysisModeChange={regenerateSummaryWithMode} />
            </section>

            {isLoading && !isFetching && (
              <section className="mt-12">
                <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-4 py-6 md:py-8 text-center text-xs text-muted-foreground space-y-1">
          <p>본 서비스는 지식재산처/한국특허정보원의 공공데이터를 활용하여 제작되었습니다</p>
          <p>KIPRIS(한국특허정보원) 데이터 연동 · AI 기반 특허 분석</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
