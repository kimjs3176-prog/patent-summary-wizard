import { useState } from "react";
import { Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const formatPatentNumber = (value: string): string => {
    const digitsOnly = value.replace(/[^0-9]/g, "");
    if (value.replace(/[-\s]/g, "").length !== digitsOnly.length && digitsOnly.length < 7) {
      return value;
    }
    if (digitsOnly.length >= 9 && digitsOnly.length <= 10 && digitsOnly.startsWith("10")) {
      return `10-${digitsOnly.slice(2)}`;
    }
    if (digitsOnly.length === 7) {
      return `10-${digitsOnly}`;
    }
    if (digitsOnly.length >= 11 && digitsOnly.startsWith("10")) {
      const year = digitsOnly.slice(2, 6);
      const num = digitsOnly.slice(6);
      return `10-${year}-${num}`;
    }
    return value;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatPatentNumber(raw);
    setInputValue(formatted);
  };

  const isPatentNumber = (value: string): boolean => {
    const trimmed = value.trim();
    return trimmed.match(/^10-\d+/) !== null || trimmed.match(/^KR\d+/i) !== null || trimmed.match(/^\d{7,}$/) !== null;
  };

  const handleKeywordSearch = async (keyword: string) => {
    if (!keyword.trim() || keyword.trim().length < 1) {
      toast.error("검색어를 1자 이상 입력해주세요.");
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
        body: JSON.stringify({ keyword })
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
      onSubmit(value);
    } else {
      handleKeywordSearch(value);
    }
  };

  const isProcessing = isLoading || isSearchingKeyword;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-card rounded-2xl md:rounded-3xl p-5 md:p-8 border border-border/60 shadow-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FileText className="h-4.5 w-4.5 text-muted-foreground/60" />
              </div>
              <input
                type="text"
                placeholder="특허등록번호 출원번호 또는 관심 키워드를 입력하세요"
                value={inputValue}
                onChange={handleInputChange}
                className="w-full h-14 pl-12 pr-5 text-sm md:text-base bg-secondary/40 border border-border/50 rounded-xl text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground/60 placeholder:text-xs placeholder:md:text-sm focus:border-primary/60 focus:bg-secondary/60 focus:shadow-[0_0_0_3px_hsla(174,72%,30%,0.1)]"
                disabled={isProcessing}
              />
            </div>
            <Button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="h-14 px-8 text-base font-bold bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary/75 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 rounded-xl whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {isSearchingKeyword ? "검색 중..." : "요약 중..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  {inputValue.trim() && !isPatentNumber(inputValue.trim()) ? "검색하기" : "요약하기"}
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
