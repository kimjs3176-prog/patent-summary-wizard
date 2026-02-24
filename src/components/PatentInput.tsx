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

export function PatentInput({ onSubmit, isLoading, onKeywordSearch }: PatentInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSearchingKeyword, setIsSearchingKeyword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
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
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex-col items-stretch flex md:flex-col gap-[12px]">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="특허등록번호, 출원번호 또는 키워드 입력"
              value={inputValue}
              onChange={handleInputChange}
              className="w-full h-12 pl-11 pr-4 text-sm bg-card/80 backdrop-blur-sm border border-border/40 rounded-2xl text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/60 focus:border-foreground/20 focus:bg-card focus:ring-2 focus:ring-foreground/5 focus:shadow-[0_0_20px_hsl(174_60%_50%/0.08)] px-[159px] my-0"
              style={{ boxShadow: 'var(--shadow-glossy)' }}
              disabled={isProcessing} />

          </div>
          <Button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className="h-12 px-6 text-sm font-semibold bg-foreground hover:bg-foreground/90 text-background rounded-2xl transition-all duration-300 disabled:opacity-40 shadow-md hover:shadow-lg">

            {isProcessing ?
            <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                {isSearchingKeyword ? "검색 중..." : "요약 중..."}
              </span> :

            <span className="flex items-center gap-2 font-sans text-center font-bold text-base">
                <Search className="w-4 h-4" />
                {inputValue.trim() && !isPatentNumber(inputValue.trim()) ? "검색" : "요약"}
              </span>
            }
          </Button>
        </div>
        <p className="text-center text-card-foreground text-sm">관심있는 키워드나 특허 등록번호(예: 10-2920574)/출원번호(예:10-2022-1213421)를 입력하세요

        </p>
      </form>
    </div>);

}