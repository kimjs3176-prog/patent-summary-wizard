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
      <header className="w-full border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">특허요약</h1>
              <p className="text-xs text-muted-foreground">Patent Summary</p>
            </div>
          </div>
          {(summary || isLoading) && <Button variant="outline" size="sm" onClick={() => { updateUrl(); reset(); }} className="border-border/50 bg-card/50 hover:bg-card text-foreground">
              새로운 특허 검색
            </Button>}
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {!summary && !isLoading ? <>
            {/* Hero Section */}
            <section className="text-center max-w-3xl mx-auto mb-16 animate-fade-down">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent mb-8 border border-accent/30 animate-pulse-subtle">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">KIPRIS 특허 데이터 연동</span>
              </div>
              
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground mb-6 leading-tight">
                농식품 특허{' '}
                <span className="gradient-text">AI 요약</span>{' '}
                서비스      
              </h2>
              
              <p className="text-lg text-muted-foreground font-light tracking-wide">
                 농식품 분야 특허를 AI가 자동으로 분석하고 요약합니다
              </p>
            </section>

            {/* Input Section + Search History */}
            <section className="mb-4 animate-fade-up" style={{
          animationDelay: "0.2s"
        }}>
              <div className="w-full max-w-4xl mx-auto flex gap-6 items-start justify-center">
                <div className="flex-1 max-w-2xl space-y-3">
                  <PatentInput onSubmit={handleSubmit} isLoading={isLoading} onKeywordSearch={handleKeywordSearch} />
                  {history.length > 0 && keywordResults.length === 0 && (
                    <div className="px-2">
                      <SearchHistory history={history} onSelect={handleHistorySelect} onRemove={removeFromHistory} onClear={clearHistory} />
                    </div>
                  )}
                </div>
                <div className="hidden lg:block flex-shrink-0">
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
              <PatentSummary content={summary} patentNumber={currentPatent} isStreaming={isLoading} patentData={patentData} relatedPatents={relatedPatents} onRelatedPatentClick={handleSubmit} />
            </section>

            {/* Loading Input for new search during streaming */}
            {isLoading && !isFetching && <section className="mt-12">
                <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
              </section>}
          </>}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto relative z-10">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>KIPRIS(한국특허정보원) 데이터 연동 • AI 기반 특허 분석</p>
        </div>
      </footer>
    </div>;
};
export default Index;