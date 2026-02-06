import { FileText, Sparkles, Shield, Zap, Database } from "lucide-react";
import { PatentInput } from "@/components/PatentInput";
import { PatentSummary } from "@/components/PatentSummary/index";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import { useSearchHistory, SearchHistoryItem } from "@/hooks/useSearchHistory";
import { SearchHistory } from "@/components/SearchHistory";
import { Button } from "@/components/ui/button";
import { KeywordSearchResults } from "@/components/KeywordSearchResults";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
import { useState } from "react";
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
  const features = [{
    icon: Database,
    title: "KIPRIS 연동",
    description: "한국특허정보원(KIPRIS) 공식 데이터를 사용합니다"
  }, {
    icon: Zap,
    title: "빠른 AI 요약",
    description: "AI가 몇 초 만에 핵심 내용을 추출합니다"
  }, {
    icon: FileText,
    title: "1페이지 포맷",
    description: "깔끔하게 정리된 요약서를 제공합니다"
  }, {
    icon: Shield,
    title: "농촌진흥청 특허 우선",
    description: "농촌진흥청 출원 특허를 우선 표시합니다"
  }];

  // Handle patent search with history saving
  const handleSubmit = async (patentNumber: string) => {
    // Clear keyword results when starting a patent search
    setKeywordResults([]);
    setSearchedKeyword("");
    const result = await generateSummary(patentNumber);
    if (result && result.patentData) {
      addToHistory({
        patentNumber,
        patentData: result.patentData,
        summary: result.summary,
        relatedPatents: result.relatedPatents || []
      });
    }
  };

  // Handle selecting from history
  const handleHistorySelect = (item: SearchHistoryItem) => {
    setKeywordResults([]);
    setSearchedKeyword("");
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
  return <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="w-full border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground">특허요약</h1>
              <p className="text-xs text-muted-foreground">Patent Summary</p>
            </div>
          </div>
          {(summary || isLoading) && <Button variant="outline" size="sm" onClick={reset}>
              새로운 특허 검색
            </Button>}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {!summary && !isLoading ? <>
            {/* Hero Section */}
            <section className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent mb-6 animate-fade-up">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">KIPRIS 특허 데이터 연동</span>
              </div>
              
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-6 animate-fade-up" style={{
            animationDelay: "0.1s"
          }}>
                농식품 특허
                <span className="gradient-text block">AI SMK 요약 서비스</span>
              </h2>
              
              
            </section>

            {/* Input Section */}
            <section className="mb-12" style={{
          animationDelay: "0.3s"
        }}>
              <PatentInput onSubmit={handleSubmit} isLoading={isLoading} onKeywordSearch={handleKeywordSearch} />
            </section>

            {/* Keyword Search Results Section */}
            {keywordResults.length > 0 && <section className="mb-12 animate-fade-up" style={{
          animationDelay: "0.35s"
        }}>
                <KeywordSearchResults results={keywordResults} keyword={searchedKeyword} onPatentSelect={handleKeywordPatentSelect} onClose={handleClearKeywordResults} isLoading={isLoading} />
              </section>}

            {/* Search History Section */}
            {history.length > 0 && keywordResults.length === 0 && <section className="mb-12 max-w-2xl mx-auto animate-fade-up" style={{
          animationDelay: "0.35s"
        }}>
                <SearchHistory history={history} onSelect={handleHistorySelect} onRemove={removeFromHistory} onClear={clearHistory} />
              </section>}

            {/* Features */}
            <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {features.map((feature, index) => <div key={feature.title} className="p-6 rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-glow transition-all duration-300 animate-fade-up" style={{
            animationDelay: `${0.4 + index * 0.1}s`
          }}>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>)}
            </section>
          </> : <>
            {/* Loading State */}
            {isFetching && <div className="text-center mb-8 animate-fade-up">
                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-accent/10 border border-accent/20">
                  <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <span className="text-accent font-medium">KIPRIS에서 특허 데이터 조회 중...</span>
                </div>
              </div>}

            {/* Summary Section */}
            <section className="mb-8">
              <PatentSummary content={summary} patentNumber={currentPatent} isStreaming={isLoading} patentData={patentData} relatedPatents={relatedPatents} />
            </section>

            {/* Loading Input for new search during streaming */}
            {isLoading && !isFetching && <section className="mt-12">
                <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
              </section>}
          </>}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© 2025 농식품 특허 1페이지 요약 서비스. KIPRIS(한국특허정보원) 데이터 연동 • AI 기반 특허 분석</p>
        </div>
      </footer>
    </div>;
};
export default Index;