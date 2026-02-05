import { useState } from "react";
import { Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { KeywordSearchResult } from "@/components/PatentSummary/types";
interface PatentInputProps {
  onSubmit: (patentNumber: string) => void;
  isLoading: boolean;
  onKeywordSearch?: (results: KeywordSearchResult[], keyword: string) => void;
}
export function PatentInput({
  onSubmit,
  isLoading,
  onKeywordSearch
}: PatentInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSearchingKeyword, setIsSearchingKeyword] = useState(false);

  // 특허번호 형식 감지: 10-으로 시작하거나 KR로 시작하거나 순수 숫자
  const isPatentNumber = (value: string): boolean => {
    const trimmed = value.trim();
    return trimmed.match(/^10-\d+/) !== null || trimmed.match(/^KR\d+/i) !== null || trimmed.match(/^\d{7,}$/) !== null;
  };
  const handleKeywordSearch = async (keyword: string) => {
    if (!keyword.trim() || keyword.trim().length < 2) {
      toast.error("검색어를 2자 이상 입력해주세요.");
      return;
    }
    setIsSearchingKeyword(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-patents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          keyword
        })
      });
      const result = await response.json();
      if (result.success && result.patents) {
        if (result.patents.length === 0) {
          toast.info("검색 결과가 없습니다. 다른 키워드로 검색해보세요.");
        } else {
          toast.success(`'${keyword}' 관련 특허 ${result.patents.length}건을 찾았습니다.`);
          onKeywordSearch?.(result.patents, keyword);
        }
      } else {
        toast.error(result.error || "검색에 실패했습니다.");
      }
    } catch (error) {
      console.error("Keyword search error:", error);
      toast.error("검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearchingKeyword(false);
    }
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputValue.trim();
    if (!value) return;
    if (isPatentNumber(value)) {
      // 특허번호로 인식되면 바로 요약 생성
      onSubmit(value);
    } else {
      // 키워드로 인식되면 검색 수행
      handleKeywordSearch(value);
    }
  };
  const examplePatents = ["10-1234567", "10-2023-0012345", "10-0987654"];
  const exampleKeywords = ["제빵", "농기계", "스마트팜"];
  const isProcessing = isLoading || isSearchingKeyword;
  return <div className="w-full max-w-2xl mx-auto animate-fade-up">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <Input type="text" placeholder="특허번호 또는 키워드를 입력하세요 (예: 10-1234567 또는 제빵)" value={inputValue} onChange={e => setInputValue(e.target.value)} className="pl-12 pr-4 py-6 text-lg bg-card border-border/50 focus:border-accent shadow-card transition-all duration-300 placeholder:text-muted-foreground/60" disabled={isProcessing} />
        </div>

        <Button type="submit" disabled={!inputValue.trim() || isProcessing} className="w-full py-4 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-300">
          {isProcessing ? <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              {isSearchingKeyword ? "키워드 검색 중..." : "요약서 생성 중..."}
            </span> : <span className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              {inputValue.trim() && !isPatentNumber(inputValue.trim()) ? "키워드로 특허 검색" : "1페이지 요약서 생성"}
            </span>}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground mb-2">특허번호 입력 예시</p>
        <div className="flex flex-wrap justify-center gap-2">
          {examplePatents.map(patent => <button key={patent} type="button" onClick={() => setInputValue(patent)} className="px-3 py-1.5 text-sm rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
              {patent}
            </button>)}
        </div>
        
        <p className="text-xs text-muted-foreground mt-4 mb-2">키워드 검색 예시</p>
        <div className="flex flex-wrap justify-center gap-2">
          {exampleKeywords.map(keyword => <button key={keyword} type="button" onClick={() => setInputValue(keyword)} className="px-3 py-1.5 text-sm rounded-full bg-accent/10 hover:bg-accent/20 text-accent hover:text-accent transition-colors">
              {keyword}
            </button>)}
        </div>
      </div>
    </div>;
}