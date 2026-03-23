import { useState } from "react";
import { Search, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { KeywordSearchResult } from "@/components/PatentSummary/types";

interface PatentInputProps {
  onSubmit: (patentNumber: string) => void;
  isLoading: boolean;
  onKeywordSearch?: (results: KeywordSearchResult[], keyword: string) => void;
  placeholder?: string;
  helperText?: string;
  onFocusChange?: (focused: boolean) => void;
}

export function PatentInput({ onSubmit, isLoading, onKeywordSearch, placeholder, helperText, onFocusChange }: PatentInputProps) {
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
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
            <FileText className="h-[18px] w-[18px] text-muted-foreground/50 group-focus-within:text-primary transition-colors duration-200" />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            className="w-full h-14 pl-12 pr-36 text-sm bg-card border border-border/50 rounded-2xl text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/50 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 focus:shadow-[0_0_24px_hsl(152_76%_36%/0.08)]"
            style={{ boxShadow: 'var(--shadow-glossy)' }}
            disabled={isProcessing}
            placeholder={placeholder || "관심 키워드 또는 특허 등록번호, 출원번호를 입력하세요"}
            onFocus={() => onFocusChange?.(true)}
            onBlur={() => setTimeout(() => onFocusChange?.(false), 200)}
          />
          <div className="absolute inset-y-0 right-2 flex items-center">
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="h-10 px-5 text-sm font-semibold rounded-xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              style={{
                background: 'var(--gradient-accent)',
                color: 'white',
                boxShadow: inputValue.trim() && !isProcessing ? '0 2px 12px hsl(152 76% 36% / 0.3)' : 'none',
              }}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="hidden sm:inline">{isSearchingKeyword ? "검색 중" : "분석 중"}</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">{inputValue.trim() && !isPatentNumber(inputValue.trim()) ? "검색" : "분석"}</span>
                  <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
                </>
              )}
            </button>
          </div>
        </div>
        <p className="text-center text-muted-foreground text-xs">
          {helperText || "관심있는 키워드나 특허 등록번호(예: 10-2920574)/출원번호(예:10-2022-1213421)를 입력하세요"}
        </p>
      </form>
    </div>
  );
}
